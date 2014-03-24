#!/bin/bash
PACKAGE_NAME=versioning
PACKAGE_PATH=laika/packages/$PACKAGE_NAME

#move and setup packages
rm -rf $PACKAGE_PATH
mkdir -p $PACKAGE_PATH

cp -rf ./lib $PACKAGE_PATH
cp -rf ./package.js $PACKAGE_PATH

cd laika
laika -t 10000 $1 --ui bdd