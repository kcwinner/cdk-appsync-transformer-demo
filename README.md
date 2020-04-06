# CDK AppSync Transformer Demo

Accompanying repo for blog post regarding CDK AppSync Transformations. Find the post [here](). If you have any questions feel free to reach out here or [@KenWin0x539](https://twitter.com/KenWin0x539).

## Pre-reqs

* Node JS
* [AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html)
    * `npm install -g aws-cdk`

## Dependencies

### Transformation

* `graphql-transformer-core`
* `graphql-dynamodb-transformer`
* `graphql-connection-transformer`
* `graphql-key-transformer`
* `graphql-function-transformer`
* `graphql-versioned-transformer`
* `graphql-auth-transformer`
* `graphql-appsync-transformer`

You can find other available transformers [here](https://github.com/aws-amplify/amplify-cli/tree/master/packages)

### Custom Transformer

* `graphql-transformer-core`
* `graphql`
* `graphql-transformer-common`
* `graphql-mapping-template`
* `cloudform-types`

## Execution

### `cdk synth`

Emits the synthesized CloudFormation template. Additionally, this will run our transformer. Resolvers and generated schema go to `./appsync` directory locally. Refrain from editing the generated schema - make necessary changes in the root `./schema.graphql`. The generated file will be overwritten.

### `cdk deploy`

Deploys the stack with out generated schema, tables and resolvers.

## Getting Amplify DataStore To Work

It's a little bit hacky, but this is what I have so far. Awaiting further suggestions or ideas for optimizing. There is no native integration for the model generation at the moment.

* `amplify add api --apiId xxx`
* Copy schema to frontend amplify direction
    * From frontend - `cp ../api/appsync/schema.graphql ./amplify/#current-cloud-backend/api/api-dev/`
    * From frontend - `cp ../api/schema.graphql ./amplify/backend/api/api-dev/`
* Modify `${FRONTEND_DIR}/amplify/backend/amplify-meta.json`

```json
"api": {
    "my-cool-api-dev": {
        "service": "AppSync",
        "providerPlugin": "awscloudformation",
        ...
        ...
    }
}
```

* `amplify codegen models` - This should now work... I know, it's not lovely.

## Where Do We Go From Here?

We believe this would work much better as a CDK plugin or an npm package. Unfortunately, the CDK plugin system currently only supports credential providers at the moment. I played around with writing it in as a plugin (it sort of works), but you would have to write the cfdoc to a file and read it from your app to bring in the resources. Perhaps an opinionated AppSync API Construct would be best here.

I'm not sold on the `transform.conf.json` method for triggering the sync enablement. I went this route because this is what the Amplify libraries do. Originally I was going to have props passed in to the `SchemaTransformer` (there are still some remnants of this code as I decide what to do...).

## Resources / References

* [Amplify GraphQL Transform](https://aws-amplify.github.io/docs/cli-toolchain/graphql)
* [GraphQL Auto Transformer](https://github.com/hirochachacha/graphql-auto-transformer)