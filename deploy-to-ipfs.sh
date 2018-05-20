#!/bin/bash
node_modules/typescript/bin/tsc -p tsconfig.json
mkdir -p /tmp/deploy
cp ./index.html /tmp/deploy/
cp ./view.js /tmp/deploy/
cp ./LICENSE /tmp/deploy/
cp ./bundle.js /tmp/deploy/
cd /tmp/deploy/
ipfs add -Qr . | ipfs name publish --key=ipfsearch-webapp --ttl=1h
scp -qrp . root@ipfsearch.xyz:/www/
ssh root@ipfsearch.xyz "cat /www/adsnippet >> /www/index.html