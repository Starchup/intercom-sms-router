#!/bin/bash
set -e

# Get the SSH key for accessing deployment server
echo -e $PRIVATE_SSH_KEY >> key_file
chmod 600 key_file

# Deploy
scp -o StrictHostKeyChecking=no -i key_file root@stage.starchup.com:~/deployments/deploy.sh .
./deploy.sh $CI_REPO_NAME $CI_BRANCH $CI_COMMIT_ID