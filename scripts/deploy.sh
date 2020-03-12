#!/bin/sh

echo "Running cdk synth > template.yaml"
cdk synth > template.yaml

STAGE=${STAGE:-"dev"}
REGION=${REGION:-"us-east-2"}
ACCOUNT=`aws sts get-caller-identity --query 'Account' --output text`

S3_BUCKET="sam-deployments-${REGION}-${ACCOUNT}"
OUTPUT_FILE="sam-output.yaml"
STACK_NAME="demo-api-${STAGE}"
TEMPLATE_FILE=".aws-sam/build/template.yaml"

rm ${OUTPUT_FILE}
rm -rf .aws-sam

sam build

sam package \
    --template-file ${TEMPLATE_FILE} \
    --s3-bucket ${S3_BUCKET} \
    --output-template-file ${OUTPUT_FILE}

sam deploy \
    --template-file ${OUTPUT_FILE} \
    --stack-name ${STACK_NAME} \
    --capabilities CAPABILITY_IAM \
    --s3-bucket ${S3_BUCKET} \
    --region ${REGION} \
    --parameter-overrides \
        Stage=${STAGE}