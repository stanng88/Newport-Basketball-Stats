// Azure Static Web App (Free tier) hosting the stats site in ../site.
// Deploy: az deployment group create -g <rg> -f infra/main.bicep
// Content is uploaded separately with the SWA CLI (see README).

@description('Static Web App name (part of the management name, not the public hostname).')
param name string = 'newport-gold-14u-stats'

@description('Region for the Static Web App resource. Free tier is served globally regardless.')
param location string = 'eastus2'

param tags object = {
  Environment: 'production'
  Project: 'BasketballStats'
  Owner: 'SystemSphere'
}

resource site 'Microsoft.Web/staticSites@2023-12-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {}
}

output hostname string = site.properties.defaultHostname
output siteName string = site.name
