# Frontend Example

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Amplify Setup

* `amplify init`

### Add Api And Codegen

* `amplify codegen add --apiId xxx` - This will download the introspection schema
    * Follow prompts
    * `javascript`
    * `enter`
    * `Y`
    * `Y`


* `mkdir -p ./amplify/#current-cloud-backend/api/demo-api-demo/ && cp ../appsync/schema.graphql "$_"`
* `mkdir -p ./amplify/backend/api/demo-api-demo/ && cp ../schema.graphql "$_"`
* This is where you have to modify your `amplify/backend/amplify-meta.json` file
    * Add the line `"providerPlugin": "awscloudformation",` underneath `"service": "AppSync",`
    * Since we are also using a custom field directive that I built, @nullable, in the example, we have to remove that from `amplify/backend/api/demo-api-demo/schema.graphql`. Don't worry, I'll figure something better out for this...
* `amplify codegen models`


* `cp ../appsync/schema.graphql ./amplify/#current-cloud-backend/api/demo-api-demo/`
* `cp ../schema.graphql ./amplify/backend/api/demo-api-demo/`