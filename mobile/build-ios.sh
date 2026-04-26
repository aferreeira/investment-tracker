#!/bin/bash

# Investment Tracker Mobile - iOS Build Script
# This script automates the complete build and deployment process to physical iPhone

set -e  # Exit on any error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Investment Tracker - iOS Build${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Step 1: Navigate to mobile directory
echo -e "${YELLOW}[1/6]${NC} Navigating to mobile directory..."
cd "$(dirname "$0")" || exit 1
echo -e "${GREEN}✓ In: $(pwd)${NC}"
echo ""

# Step 2: Clean up previous build artifacts
echo -e "${YELLOW}[2/6]${NC} Cleaning up previous build artifacts..."
rm -rf android ios node_modules package-lock.json .expo
echo -e "${GREEN}✓ Cleanup complete${NC}"
echo ""

# Step 3: Switch to Node v24.15.0
echo -e "${YELLOW}[3/6]${NC} Checking Node version..."
if command -v nvm &> /dev/null; then
    nvm use v24.15.0
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ Switched to Node: $NODE_VERSION${NC}"
else
    NODE_VERSION=$(node --version)
    echo -e "${YELLOW}⚠ nvm not in PATH, using current Node: $NODE_VERSION${NC}"
    if [[ ! $NODE_VERSION =~ ^v24\. ]]; then
        echo -e "${YELLOW}   Recommended: Node v24.15.0 (current: $NODE_VERSION)${NC}"
    else
        echo -e "${GREEN}✓ Node v24 detected${NC}"
    fi
fi
echo ""

# Step 4: Install dependencies
echo -e "${YELLOW}[4/7]${NC} Installing npm dependencies with --legacy-peer-deps..."
npm install --legacy-peer-deps
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Step 5: Generate iOS project with prebuild
echo -e "${YELLOW}[5/7]${NC} Generating iOS project (npx expo prebuild --clean)..."
echo "y" | npx expo prebuild --clean
echo -e "${GREEN}✓ iOS project generated${NC}"
echo ""

# Step 6: Prompt to connect device
echo -e "${YELLOW}[6/7]${NC} Device Connection Required"
echo -e "${YELLOW}========================================${NC}"
echo -e "Please connect your iPhone via USB cable."
echo -e "Device ID: 00008140-000C698022D8801C"
echo -e "Alexandre iPhone (26.3.1)"
echo ""
echo -e "${BLUE}Press ENTER when your iPhone is connected...${NC}"
read -r

# Step 7: Build and deploy to device
echo ""
echo -e "${YELLOW}[7/7]${NC} Building and deploying to iPhone..."
echo -e "${YELLOW}   Device: 00008140-000C698022D8801C${NC}"
npx expo run:ios --device 00008140-000C698022D8801C
echo ""

echo -e "${BLUE}================================${NC}"
echo -e "${GREEN}✓ Build Complete!${NC}"
echo -e "${BLUE}================================${NC}"
