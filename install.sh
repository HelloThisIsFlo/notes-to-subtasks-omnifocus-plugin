#!/bin/bash
set -euo pipefail
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

cd "$DIR"


cp -r ./*.omnifocusjs "$HOME/Library/Mobile Documents/iCloud~com~omnigroup~OmniFocus/Documents/Plug-Ins/Other/Keyboard Shortcuts"


cd - >/dev/null
