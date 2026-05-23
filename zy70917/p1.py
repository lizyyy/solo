code = '''package main

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

type SkillLevel string

const (
	SkillLevelBasic        SkillLevel = "basic"
	SkillLevelIntermediate SkillLevel = "intermediate"
	SkillLevelAdvanced     SkillLevel = "advanced"
)

type ServiceOrder struct {
	ID, ElderID, NurseID, ServiceType, RequiredSkill string
	SkillLevel, ServiceDate, StartTime, EndTime       string
	ServiceAddress, District, CancelReason, Remark    string
	IsCancelled                                        bool
}
'''
with open('main.go', 'w') as f:
    f.write(code)
print("p1 done")
