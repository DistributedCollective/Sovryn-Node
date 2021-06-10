#!/bin/bash

DOCKER_BUILDKIT=1

docker build -f Dockerfile-base \
                --cache-from sovrynbase:latest -t sovrynbase:latest . \
                --build-arg BUILDKIT_INLINE_CACHE=1 \
                -t sovrynbase:latest



# docker build -f  Dockerfile.base \
#              --cache-from accountid-remoterepo.dkr.ecr.eu-west-1.amazonaws.com/sovrynbase:latest \
#              --build-arg BUILDKIT_INLINE_CACHE=1 \
#              -t accountid-remoterepo.dkr.ecr.eu-west-1.amazonaws.com/sovrynbase:latest .