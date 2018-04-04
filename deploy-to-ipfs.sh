#!/bin/bash
mkdir -p /tmp/deploy
cp ./index.html /tmp/deploy/
cp ./view.js /tmp/deploy/
cp ./LICENSE /tmp/deploy/
cp ./bundle.js /tmp/deploy/
cd /tmp/deploy/
ipfs add -Qr . | ipfs name publish --key=ipfsearch-webapp