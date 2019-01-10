#!/bin/bash
node_modules/typescript/bin/tsc -p tsconfig.json
mkdir -p /tmp/deploy/basicresultpage
cp ./index.html /tmp/deploy/
cp ./view.js /tmp/deploy/
cp ./LICENSE /tmp/deploy/
cp ./bundle.js /tmp/deploy/
cp ./basicresultpage/* /tmp/deploy/basicresultpage/
cd /tmp/deploy/
ipfs add -Qr . | ipfs name publish --key=ipfsearch-webapp --ttl=1h
scp -qrp . root@dev.ipfsearch.xyz:/www/
ssh root@dev.ipfsearch.xyz "cat /www/adsnippet >> /www/index.html"