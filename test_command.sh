#!/bin/bash
bin="build/bin/Glance"
echo "Testing with bin=$bin"
echo "Command to run from project root: bash scripts/embed-widget.sh \"$bin\""

# Ensure the bin directory exists for testing if it doesn't
mkdir -p build/bin
touch build/bin/Glance

# Try running it from the project root
bash scripts/embed-widget.sh "$bin"
