FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# ‰”Œ „·›«  «·‹ csproj
COPY ["BookFlowAI.Api/BookFlowAI.Api.csproj", "BookFlowAI.Api/"]
COPY ["BookFlowAI.Application/BookFlowAI.Application.csproj", "BookFlowAI.Application/"]
COPY ["BookFlowAI.Domain/BookFlowAI.Domain.csproj", "BookFlowAI.Domain/"]
COPY ["BookFlowAI.Infrastructure/BookFlowAI.Infrastructure.csproj", "BookFlowAI.Infrastructure/"]

# «” —Ã«⁄ «·Õ“„
RUN dotnet restore "BookFlowAI.Api/BookFlowAI.Api.csproj"

# ‰”Œ »«ﬁÌ √ﬂÊ«œ «·„‘—Ê⁄
COPY . .

WORKDIR "/src/BookFlowAI.Api"
RUN dotnet build "BookFlowAI.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "BookFlowAI.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "BookFlowAI.Api.dll"]