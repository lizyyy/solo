import sys

def append_part(filename, content):
    with open(filename, 'a', encoding='utf-8') as f:
        f.write(content)
    print(f"Appended {len(content.splitlines())} lines")

# Start fresh - write the header
header = '''package main

import (
	"crypto/md5"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)
'''

with open('main.go', 'w', encoding='utf-8') as f:
    f.write(header)
print(f"Wrote header: {len(header.splitlines())} lines")
