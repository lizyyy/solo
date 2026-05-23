import os
import sys

def main():
    content = []
    
    content.append('package main')
    content.append('')
    content.append('import (')
    content.append('\t"crypto/md5"')
    content.append('\t"encoding/csv"')
    content.append('\t"encoding/hex"')
    content.append('\t"encoding/json"')
    content.append('\t"fmt"')
    content.append('\t"log"')
    content.append('\t"net/http"')
    content.append('\t"strconv"')
    content.append('\t"strings"')
    content.append('\t"sync"')
    content.append('\t"time"')
    content.append('')
    content.append('\t"github.com/gin-gonic/gin"')
    content.append('\t"github.com/google/uuid"')
    content.append(')')
    content.append('')
    
    with open('main.go', 'w') as f:
        f.write('\n'.join(content))
    print(f"Created main.go with {len(content)} lines")

if __name__ == '__main__':
    main()
