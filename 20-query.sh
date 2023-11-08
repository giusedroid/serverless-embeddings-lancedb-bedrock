#!/bin/bash

usage() {
  echo "Usage: $0 <stack-name> <prompt-path>"
  echo "Please provide your stack name. You can find it in your samconfig.toml"
  echo "Example: $0 my-stack-name ./events/prompt.json"
  echo "This script queries LanceDB for similar documents to your prompt"
}

# Make sure the AWS CLI is installed
if ! command -v aws &> /dev/null
then
    echo "AWS CLI could not be found. Please install it."
    exit 1
fi

# Make sure node is installed
if ! command -v node &> /dev/null
then
    echo "NodeJs not installed. Please install vesion $(cat ./document-processor/.nvmrc)"
    exit 1
fi

# Check if at least one argument is provided
if [ "$#" -ne 2 ]; then
  usage
  exit 1
fi

STACK_NAME=$1
PROMPT_PATH=$2


# The name of the S3 bucket
DOCUMENT_BUCKET=$(aws cloudformation \
    describe-stacks --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`DocumentBucketName`].OutputValue' \
    --output text\
    )

DOCUMENT_TABLE=$(aws cloudformation \
    describe-stacks --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`DocumentTableName`].OutputValue' \
    --output text\
    )

AWS_REGION=$(aws cloudformation \
    describe-stacks --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`DeploymentRegion`].OutputValue' \
    --output text\
    )
    
node ./document-processor/client.mjs $DOCUMENT_BUCKET $DOCUMENT_TABLE $PROMPT_PATH $AWS_REGION