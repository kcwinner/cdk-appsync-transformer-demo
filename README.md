# CDK AppSync Transformer Demo

Accompanying repo for blog post regarding CDK AppSync Transformations. Find the post [here]()

## Pre-reqs

* Node JS
* [AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html)
    * `npm install -g aws-cdk`
* 

## Dependencies

## Execution

* `cdk synth`       Emits the synthesized CloudFormation template. Additionally, this will run our transformer
* `cdk deploy`      Deploys the stack

## Resources / References

* [Amplify GraphQL Transform](https://aws-amplify.github.io/docs/cli-toolchain/graphql)

## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth > template.yaml && sam build && sam local invoke`     Allows for running of sam locally