targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the azd environment, used to name and tag resources.')
param environmentName string

@minLength(1)
@description('Location of the resource group.')
param location string

// Static Web Apps are served from a global CDN. This region only holds the resource's metadata,
// and only a few regions are allowed. East Asia is the closest one to Australia and New Zealand.
@allowed(['eastasia', 'centralus', 'eastus2', 'westeurope', 'westus2'])
@description('Region for the Static Web App resource.')
param staticWebAppLocation string = 'eastasia'

var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var tags = { 'azd-env-name': environmentName }

resource resourceGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

module web 'web.bicep' = {
  name: 'web'
  scope: resourceGroup
  params: {
    name: 'stapp-jambo-${resourceToken}'
    location: staticWebAppLocation
    tags: union(tags, { 'azd-service-name': 'web' })
  }
}

output AZURE_RESOURCE_GROUP string = resourceGroup.name
output WEB_URI string = web.outputs.uri
