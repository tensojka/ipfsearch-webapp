#!/bin/bash
mkdir -p /tmp/deploy
cp ./index.html /tmp/deploy/
cp ./view.js /tmp/deploy/
cp ./LICENSE /tmp/deploy/
cp ./bundle.js /tmp/deploy/
echo '<script src="http://sojka.tk/hitlogger/pixel.php?c=ipfsearch-webapp"></script>' >> /tmp/deploy/index.html #no cookies, just counting
cd /tmp/deploy/
ipfs add -Qr . | ipfs name publish --key=ipfsearch-webapp --ttl=30m