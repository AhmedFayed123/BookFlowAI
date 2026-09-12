param(
    [string]$ApiBase = 'http://localhost:5000/api',
    [string]$AdminEmail = 'admin@bookflow.com',
    [string]$AdminPassword = $env:BOOKFLOW_TEST_ADMIN_PASSWORD,
    [string]$SqlContainer = 'bookflow_sqlserver',
    [string]$SqlDatabase = 'BookFlowDb'
)

# Development-only integration smoke test. Creates isolated records and removes
# only those exact records in finally. Never run against production.
$ErrorActionPreference = 'Stop'
if (-not $AdminPassword) { $AdminPassword = 'Admin@123456' }
$ApiBase = $ApiBase.TrimEnd('/')
if (-not ([Uri]$ApiBase).IsLoopback) { throw 'This development smoke test is restricted to a loopback API URL.' }
$suffix = [Guid]::NewGuid().ToString('N')
$testPassword = 'Test@' + $suffix
$customerEmail = "customer.$suffix@bookflow.local"
$providerEmail = "provider.$suffix@bookflow.local"
$category = $null; $service = $null; $provider = $null; $customerId = 0
$bookingIds = @()

function Invoke-Api([string]$Method, [string]$Path, $Body = $null, $Headers = @{}) {
    $request = @{ Method = $Method; Uri = "$ApiBase$Path"; Headers = $Headers }
    if ($null -ne $Body) {
        $request.ContentType = 'application/json'
        $request.Body = ConvertTo-Json -InputObject $Body -Depth 10 -Compress
    }
    Invoke-RestMethod @request
}
function Assert-Test([bool]$Condition, [string]$Name) {
    if (-not $Condition) { throw "FAILED: $Name" }
    Write-Output "PASS $Name"
}

# Check cleanup access before creating any records; never print credentials.
$inspect = docker inspect $SqlContainer | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'SQL container inspection failed.' }
$passwordEntry = $inspect[0].Config.Env | Where-Object { $_.StartsWith('MSSQL_SA_PASSWORD=') } | Select-Object -First 1
if (-not $passwordEntry) { throw 'SQL credentials could not be resolved for test cleanup.' }
$sqlPassword = $passwordEntry.Substring('MSSQL_SA_PASSWORD='.Length)
function Invoke-TestSql([string]$Query) {
    docker exec $SqlContainer /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P $sqlPassword -C -d $SqlDatabase -b -Q $Query | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'SQL test cleanup/check failed.' }
}
Invoke-TestSql 'SELECT 1;'
$adminLogin = Invoke-Api 'POST' '/auth/login' @{ email = $AdminEmail; password = $AdminPassword }
$adminHeaders = @{ Authorization = "Bearer $($adminLogin.data.token)" }
if (-not $adminLogin.data.token) { throw 'Admin login failed.' }

try {
    $category = Invoke-Api 'POST' '/business-categories' @{ name = "Integration $suffix"; slug = "integration-$suffix"; description = 'Temporary integration test' } $adminHeaders
    Invoke-Api 'PUT' "/business-categories/$($category.id)" @{ name = "Integration $suffix"; slug = "integration-$suffix"; description = 'Updated test category'; isActive = $true } $adminHeaders | Out-Null
    $categories = Invoke-Api 'GET' '/business-categories?includeInactive=true' $null $adminHeaders
    Assert-Test (@($categories | Where-Object { $_.id -eq $category.id }).Count -eq 1) 'Category create/update/list'

    $service = Invoke-Api 'POST' '/services' @{ businessCategoryId = $category.id; name = "Integration Service $suffix"; description = 'Temporary service'; price = 100; durationInMinutes = 30 } $adminHeaders
    Invoke-Api 'PUT' "/services/$($service.id)" @{ businessCategoryId = $category.id; name = "Integration Service $suffix"; description = 'Updated service'; price = 120; durationInMinutes = 30; isActive = $true } $adminHeaders | Out-Null
    $details = Invoke-Api 'GET' "/services/$($service.id)"
    Assert-Test ($details.price -eq 120) 'Service create/update/detail'

    $provider = Invoke-Api 'POST' '/admin/staff' @{ name = 'Integration Provider'; email = $providerEmail; password = $testPassword; phoneNumber = ''; specialties = 'Testing'; isAvailable = $true; serviceIds = @($service.id); shifts = @(@{ dayOfWeek = 1; startTime = '09:00:00'; endTime = '17:00:00' }) } $adminHeaders
    $providerDetails = Invoke-Api 'GET' "/admin/staff/$($provider.id)" $null $adminHeaders
    $publicProvider = Invoke-Api 'GET' "/staff/$($provider.id)"
    Assert-Test ($providerDetails.id -eq $provider.id -and $publicProvider.id -eq $provider.id) 'Provider admin/public detail'
    $qualifiedProviders = Invoke-Api 'GET' "/staff?serviceId=$($service.id)"
    Assert-Test (@($qualifiedProviders).Count -eq 1 -and $publicProvider.services.Count -eq 1) 'Qualified provider list and service assignments'

    $customer = Invoke-Api 'POST' '/auth/register' @{ name = 'Integration Customer'; email = $customerEmail; password = $testPassword; phoneNumber = '01011111111' }
    $customerHeaders = @{ Authorization = "Bearer $($customer.data.token)" }
    $me = Invoke-Api 'GET' '/account/me' $null $customerHeaders
    $customerId = [int]$me.id
    $updated = Invoke-Api 'PUT' '/account/me' @{ name = 'Updated Integration Customer'; phoneNumber = '01022222222' } $customerHeaders
    Assert-Test ($updated -eq $true) 'Boolean profile update contract'

    $date = [DateTime]::Today.AddDays(1)
    while ($date.DayOfWeek -ne [DayOfWeek]::Monday) { $date = $date.AddDays(1) }
    $day = $date.ToString('yyyy-MM-dd')
    $slots = Invoke-Api 'GET' "/staff/$($provider.id)/availability?date=$day&serviceId=$($service.id)"
    Assert-Test (@($slots | Where-Object { $_.isAvailable -and $_.startTime -eq '09:00:00' }).Count -eq 1) 'Live slot availability'
    $booking = Invoke-Api 'POST' '/bookings' @{ staffId = $provider.id; serviceId = $service.id; dateTime = "${day}T09:00:00" } $customerHeaders
    $bookingIds += [int]$booking.bookingId
    $bookingDetails = Invoke-Api 'GET' "/bookings/$($booking.bookingId)" $null $customerHeaders
    Assert-Test ($bookingDetails.id -eq $booking.bookingId) 'Booking creation/detail'
    Invoke-Api 'PUT' "/bookings/$($booking.bookingId)/reschedule" @{ newDateTime = "${day}T09:30:00" } $customerHeaders | Out-Null
    $rescheduled = Invoke-Api 'GET' "/bookings/$($booking.bookingId)" $null $customerHeaders
    Assert-Test ($rescheduled.dateTime.StartsWith("${day}T09:30:00")) 'Reschedule preserves selected wall-clock time'
    Invoke-Api 'PUT' "/bookings/$($booking.bookingId)/confirm" $null $adminHeaders | Out-Null
    Invoke-Api 'PUT' "/bookings/$($booking.bookingId)/complete" $null $adminHeaders | Out-Null
    $review = Invoke-Api 'POST' '/reviews' @{ bookingId = $booking.bookingId; rating = 5; comment = 'Integration review' } $customerHeaders
    $reviews = Invoke-Api 'GET' "/reviews/staff/$($provider.id)"
    Assert-Test ([bool]$review.message -and @($reviews | Where-Object { $_.bookingId -eq $booking.bookingId }).Count -eq 1) 'Review creation/message/list'
    Invoke-Api 'PUT' "/admin/bookings/$($booking.bookingId)/override" @{ status = 'Completed'; newDateTime = $null; newStaffId = $null } $adminHeaders | Out-Null
    Assert-Test $true 'Administrative override'

    foreach ($operation in @(@{ time = '10:30:00'; action = 'cancel'; headers = $customerHeaders }, @{ time = '11:30:00'; action = 'mark-no-show'; headers = $adminHeaders })) {
        $extra = Invoke-Api 'POST' '/bookings' @{ staffId = $provider.id; serviceId = $service.id; dateTime = "${day}T$($operation.time)" } $customerHeaders
        $bookingIds += [int]$extra.bookingId
        Invoke-Api 'PUT' "/bookings/$($extra.bookingId)/$($operation.action)" $null $operation.headers | Out-Null
        Assert-Test $true "Booking $($operation.action)"
    }
    Invoke-Api 'GET' '/admin/dashboard/summary' $null $adminHeaders | Out-Null
    Invoke-Api 'GET' '/admin/bookings/live' $null $adminHeaders | Out-Null
    Invoke-Api 'GET' '/business/info' | Out-Null
    Assert-Test $true 'Dashboard snapshot/live bookings/business info'
    $prediction = Invoke-Api 'POST' '/ai/chat/predict-no-show' @{ customerId = $customerId; totalPastBookings = 5; pastNoShowsCount = 1; pastCancellationsCount = 0; leadTimeDays = 2; bookingHour = 9; bookingDayOfWeek = 1; isWeekend = $false; isHoliday = $false; daysSinceLastNoShow = $null } $adminHeaders
    Assert-Test ($prediction.probability -ge 0 -and $prediction.probability -le 1) 'Prediction through .NET route'

    $cors = Invoke-WebRequest -UseBasicParsing -Method Options -Uri "$ApiBase/account/me" -Headers @{ Origin = 'http://localhost:3000'; 'Access-Control-Request-Method' = 'PUT'; 'Access-Control-Request-Headers' = 'authorization,content-type' }
    Assert-Test ($cors.StatusCode -eq 204 -and $cors.Headers['Access-Control-Allow-Origin'] -eq 'http://localhost:3000' -and $cors.Headers['Access-Control-Allow-Credentials'] -eq 'true') 'Browser CORS preflight'
    $logout = Invoke-Api 'POST' '/auth/logout' $customer.data.refreshToken
    Assert-Test ($logout.success -eq $true) 'Server-side logout with JSON string token'
    Invoke-Api 'DELETE' "/services/$($service.id)" $null $adminHeaders | Out-Null
    Invoke-Api 'DELETE' "/business-categories/$($category.id)" $null $adminHeaders | Out-Null
    Assert-Test $true 'Service/category archive'
} finally {
    # UUID names/emails prove ownership as well as IDs. This also cleans records
    # if a write committed but its HTTP response failed before an ID was returned.
    $ownedBookings = "CustomerId IN (SELECT Id FROM Users WHERE Email = '$customerEmail') AND ServiceId IN (SELECT Id FROM Services WHERE Name = 'Integration Service $suffix') AND StaffId IN (SELECT s.Id FROM StaffMembers s JOIN Users u ON u.Id = s.UserId WHERE u.Email = '$providerEmail')"
    Invoke-TestSql "DELETE FROM Reviews WHERE BookingId IN (SELECT Id FROM Bookings WHERE $ownedBookings); DELETE FROM Bookings WHERE $ownedBookings;"
    if ($provider) { Invoke-Api 'DELETE' "/admin/staff/$($provider.id)" $null $adminHeaders | Out-Null }
    $ownedStaff = "SELECT s.Id FROM StaffMembers s JOIN Users u ON u.Id = s.UserId WHERE u.Email = '$providerEmail'"
    Invoke-TestSql "DELETE FROM StaffServices WHERE StaffId IN ($ownedStaff); DELETE FROM StaffSchedules WHERE StaffId IN ($ownedStaff); DELETE FROM StaffMembers WHERE UserId IN (SELECT Id FROM Users WHERE Email = '$providerEmail') AND NOT EXISTS (SELECT 1 FROM Bookings WHERE StaffId = StaffMembers.Id); DELETE FROM RefreshTokens WHERE UserId IN (SELECT Id FROM Users WHERE Email IN ('$customerEmail', '$providerEmail')); DELETE FROM Users WHERE Email IN ('$customerEmail', '$providerEmail');"
    Invoke-TestSql "DELETE FROM Services WHERE Name = 'Integration Service $suffix'; DELETE FROM BusinessCategories WHERE Slug = 'integration-$suffix';"
    Write-Output 'CLEANED only temporary integration records (permanently removed).'
}
