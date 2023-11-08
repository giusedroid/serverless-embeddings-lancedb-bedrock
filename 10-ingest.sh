#!/bin/bash

usage() {
  echo "Usage: $0 <stack-name>"
  echo "Please provide your stack name. You can find it in your samconfig.toml"
  echo "Example: $0 my-stack-name"
  echo "This script uploads all pdf files to an S3 bucket to trigger the creation of embeds"
}

# Make sure the AWS CLI is installed
if ! command -v aws &> /dev/null
then
    echo "AWS CLI could not be found. Please install it."
    exit
fi

# Check if at least one argument is provided
if [ "$#" -ne 1 ]; then
  usage
  exit 1
fi

STACK_NAME=$1

# The directory where your source PDFs are located
SOURCE_PATH="./documents"

# The name of the S3 bucket
DOCUMENT_BUCKET=$(aws cloudformation \
    describe-stacks --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`DocumentBucketName`].OutputValue' \
    --output text\
    )

# Check if the source path exists
if [ ! -d "$SOURCE_PATH" ]; then
  echo "Source path does not exist: $SOURCE_PATH"
  exit 1
fi

# Loop through all PDF files in the source directory
for file in "$SOURCE_PATH"/*.pdf; do
  # Skip if no PDF files are found
  if [[ ! -e $file ]]; then
    echo "No PDF files found in $SOURCE_PATH"
    break
  fi
  
  # Extract the basename of the file to use in the S3 key
  filename=$(basename "$file")
  
  # Upload to S3
  echo "Uploading $file to s3://$DOCUMENT_BUCKET/documents/$filename"
  aws s3 cp "$file" "s3://$DOCUMENT_BUCKET/documents/$filename"
  
  # Check if upload was successful
  if [ $? -ne 0 ]; then
    echo "Failed to upload $file"
  else
    echo "Uploaded $file successfully."
  fi
done

echo "All files uploaded."
