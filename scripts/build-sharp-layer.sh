#!/bin/bash
# Script to build sharp layer for AWS Lambda

LAYER_DIR="lambda/layers/sharp/nodejs"

# # Create directory structure
# mkdir -p $LAYER_DIR

# # Create package.json
# cat > $LAYER_DIR/package.json << 'EOF'
# {
#   "name": "sharp-layer",
#   "version": "1.0.0",
#   "description": "Sharp image processing library for Lambda",
#   "dependencies": {
#     "sharp": "^0.34.4"
#   }
# }
# EOF

# Install sharp with proper platform flags
cd $LAYER_DIR
npm install --os=linux --cpu=x64

echo "Sharp layer built successfully!"
