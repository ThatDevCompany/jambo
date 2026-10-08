@description('Name of the Static Web App.')
param name string

@description('Region for the Static Web App resource.')
param location string

param tags object = {}

// Free tier: HTTPS, a global CDN and a *.azurestaticapps.net domain at no cost.
resource staticWebApp 'Microsoft.Web/staticSites@2024-04-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {}
}

output name string = staticWebApp.name
output uri string = 'https://${staticWebApp.properties.defaultHostname}'
