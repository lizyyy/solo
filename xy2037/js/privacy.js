const PrivacyManager = {
    maskIdCard(idCard) {
        if (!idCard || idCard.length < 8) return idCard;
        
        if (idCard.length === 15) {
            return idCard.substring(0, 6) + '********' + idCard.substring(14);
        }
        
        if (idCard.length === 18) {
            return idCard.substring(0, 6) + '********' + idCard.substring(14);
        }
        
        const keepStart = Math.min(4, Math.floor(idCard.length / 4));
        const keepEnd = Math.min(4, Math.floor(idCard.length / 4));
        const middleLength = idCard.length - keepStart - keepEnd;
        
        if (middleLength <= 0) return idCard;
        
        return idCard.substring(0, keepStart) + '*'.repeat(middleLength) + idCard.substring(idCard.length - keepEnd);
    },

    maskBankCard(cardNumber) {
        if (!cardNumber || cardNumber.length < 8) return cardNumber;
        
        const cleaned = cardNumber.replace(/\s/g, '');
        
        if (cleaned.length >= 16) {
            return cleaned.substring(0, 4) + ' **** **** ' + cleaned.substring(cleaned.length - 4);
        }
        
        return cleaned.substring(0, 4) + '**' + cleaned.substring(cleaned.length - 4);
    },

    maskPhone(phone) {
        if (!phone || phone.length < 7) return phone;
        return phone.substring(0, 3) + '****' + phone.substring(phone.length - 4);
    },

    maskName(name) {
        if (!name || name.length <= 1) return name;
        
        if (name.length === 2) {
            return name[0] + '*';
        }
        
        return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
    },

    maskEmail(email) {
        if (!email || !email.includes('@')) return email;
        
        const [local, domain] = email.split('@');
        
        if (local.length <= 2) {
            return local[0] + '***@' + domain;
        }
        
        return local.substring(0, 2) + '***@' + domain;
    },

    maskAddress(address) {
        if (!address) return address;
        
        const patterns = [
            /[\u4e00-\u9fa5]{2,}(?:省|自治区|特别行政区)/g,
            /[\u4e00-\u9fa5]{2,}(?:市|区|县)/g,
            /[\u4e00-\u9fa5]{2,}(?:路|街|大道|胡同)/g,
            /[\u4e00-\u9fa5]{2,}(?:号|院|楼|层|室)/g,
            /\d+号/g,
            /\d+楼/g,
            /\d+层/g,
            /\d+室/g,
            /\d+单元/g
        ];

        let masked = address;
        patterns.forEach(pattern => {
            masked = masked.replace(pattern, match => {
                if (match.length <= 2) return match;
                return match[0] + '*'.repeat(match.length - 2) + match[match.length - 1];
            });
        });

        return masked;
    },

    maskSensitiveInfo(text) {
        if (!text) return text;

        let masked = text;

        const idCardPattern = /\b\d{17}[\dXx]\b|\b\d{15}\b/g;
        masked = masked.replace(idCardPattern, match => this.maskIdCard(match));

        const phonePattern = /\b1[3-9]\d{9}\b/g;
        masked = masked.replace(phonePattern, match => this.maskPhone(match));

        const bankCardPattern = /\b\d{16,19}\b/g;
        masked = masked.replace(bankCardPattern, match => this.maskBankCard(match));

        const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        masked = masked.replace(emailPattern, match => this.maskEmail(match));

        return masked;
    },

    maskDescriptionForFound(description) {
        if (!description) return '';

        const sentences = description.split(/[。！？.!?]+/).filter(s => s.trim());
        const maskedSentences = sentences.map(sentence => {
            const words = sentence.split('');
            if (words.length <= 5) return sentence;
            
            const maskStart = Math.floor(words.length * 0.3);
            const maskEnd = Math.floor(words.length * 0.7);
            
            for (let i = maskStart; i < maskEnd; i++) {
                if (words[i] !== ' ' && words[i] !== '，' && words[i] !== '、') {
                    words[i] = '*';
                }
            }
            return words.join('');
        });

        return maskedSentences.join('。');
    },

    getDocumentTypeInfo(documentType) {
        const types = {
            id_card: {
                name: '身份证',
                pattern: /^\d{17}[\dXx]$|^\d{15}$/,
                maskMethod: 'maskIdCard'
            },
            student_card: {
                name: '学生证',
                pattern: /^[A-Za-z0-9]{6,20}$/,
                maskMethod: 'maskIdCard'
            },
            bank_card: {
                name: '银行卡',
                pattern: /^\d{16,19}$/,
                maskMethod: 'maskBankCard'
            },
            driver_license: {
                name: '驾驶证',
                pattern: /^\d{17}[\dXx]$/,
                maskMethod: 'maskIdCard'
            },
            passport: {
                name: '护照',
                pattern: /^[A-Z]\d{8}$|^[A-Z]{2}\d{7}$/,
                maskMethod: 'maskIdCard'
            }
        };
        return types[documentType] || null;
    },

    validateDocumentNumber(documentType, documentNumber) {
        const typeInfo = this.getDocumentTypeInfo(documentType);
        if (!typeInfo || !documentNumber) return false;
        return typeInfo.pattern.test(documentNumber.replace(/\s/g, ''));
    },

    processFoundItemForDisplay(foundItem, isVerified = false) {
        const processed = { ...foundItem };

        if (!isVerified) {
            if (foundItem.maskedDescription) {
                processed.description = foundItem.maskedDescription;
            } else {
                processed.description = this.maskDescriptionForFound(foundItem.description);
            }

            if (foundItem.maskedDocumentNumber) {
                processed.documentNumber = foundItem.maskedDocumentNumber;
            } else if (foundItem.documentNumber) {
                const typeInfo = this.getDocumentTypeInfo(foundItem.documentType);
                if (typeInfo) {
                    processed.documentNumber = this[typeInfo.maskMethod](foundItem.documentNumber);
                } else {
                    processed.documentNumber = this.maskIdCard(foundItem.documentNumber);
                }
            }

            processed.features = foundItem.features?.map(f => {
                if (f.length > 4) {
                    return f.substring(0, 2) + '**' + (f.length > 4 ? f.substring(f.length - 1) : '');
                }
                return f;
            }) || [];
        }

        return processed;
    },

    blurImageForPrivacy(imageData) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                
                const regions = this.detectSensitiveRegions(ctx, canvas.width, canvas.height);
                
                regions.forEach(region => {
                    ctx.fillStyle = 'rgba(150, 150, 150, 0.8)';
                    ctx.fillRect(region.x, region.y, region.width, region.height);
                    
                    ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
                    ctx.lineWidth = 2;
                    for (let i = 0; i < region.height; i += 4) {
                        ctx.beginPath();
                        ctx.moveTo(region.x, region.y + i);
                        ctx.lineTo(region.x + region.width, region.y + i);
                        ctx.stroke();
                    }
                });

                resolve(canvas.toDataURL('image/jpeg', 0.9));
            };
            img.src = imageData;
        });
    },

    detectSensitiveRegions(ctx, width, height) {
        const regions = [];
        
        const centerX = width / 2;
        const centerY = height / 2;
        
        const faceWidth = Math.min(width * 0.4, 200);
        const faceHeight = Math.min(height * 0.3, 200);
        
        regions.push({
            x: centerX - faceWidth / 2,
            y: Math.max(0, centerY - faceHeight),
            width: faceWidth,
            height: faceHeight
        });

        const imageData = ctx.getImageData(0, 0, width, height);
        const cardRegions = this.detectCardRegions(imageData, width, height);
        
        return [...regions, ...cardRegions];
    },

    detectCardRegions(imageData, width, height) {
        const regions = [];
        const data = imageData.data;
        
        for (let y = 0; y < height; y += 20) {
            for (let x = 0; x < width; x += 20) {
                const idx = (y * width + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                
                if (r > 200 && g > 200 && b > 200) {
                    regions.push({
                        x: Math.max(0, x - 50),
                        y: Math.max(0, y - 30),
                        width: Math.min(width - x + 50, 150),
                        height: Math.min(height - y + 30, 80)
                    });
                }
            }
        }
        
        return regions.slice(0, 3);
    },

    renderMaskedText(text, containerId) {
        const container = document.getElementById(containerId);
        if (!container || !text) return;

        let html = '<span class="masked-text">';
        let inMask = false;
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (char === '*') {
                if (!inMask) {
                    html += '<span class="hidden">';
                    inMask = true;
                }
                html += '●';
            } else {
                if (inMask) {
                    html += '</span>';
                    inMask = false;
                }
                html += `<span class="visible">${char}</span>`;
            }
        }
        
        if (inMask) {
            html += '</span>';
        }
        html += '</span>';
        
        container.innerHTML = html;
    }
};

function maskDocumentNumber() {
    const docType = document.getElementById('found-document-type').value;
    const docNumber = document.getElementById('found-document-number').value;
    
    if (!docType || !docNumber) return;

    const typeInfo = PrivacyManager.getDocumentTypeInfo(docType);
    if (typeInfo) {
        const masked = PrivacyManager[typeInfo.maskMethod](docNumber);
        Utils.showToast(`已自动打码: ${masked}`, 'info');
    }
}

document.addEventListener('change', (e) => {
    if (e.target.id === 'found-document-number' || e.target.id === 'found-document-type') {
        maskDocumentNumber();
    }
});
