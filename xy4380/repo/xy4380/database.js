const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const DB_DIR = path.join(__dirname, 'data');
const ITEMS_FILE = path.join(DB_DIR, 'items.json');
const CLAIMS_FILE = path.join(DB_DIR, 'claims.json');
const REVIEWS_FILE = path.join(DB_DIR, 'reviews.json');
const MATCHES_FILE = path.join(DB_DIR, 'matches.json');

class Database {
    constructor() {
        this.initDB();
        this.items = this.loadData(ITEMS_FILE, []);
        this.claims = this.loadData(CLAIMS_FILE, []);
        this.reviews = this.loadData(REVIEWS_FILE, []);
        this.matches = this.loadData(MATCHES_FILE, []);
    }

    initDB() {
        if (!fs.existsSync(DB_DIR)) {
            fs.mkdirSync(DB_DIR, { recursive: true });
        }
    }

    loadData(filePath, defaultValue) {
        if (fs.existsSync(filePath)) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                return JSON.parse(content);
            } catch (e) {
                console.error(`Error loading ${filePath}:`, e);
                return defaultValue;
            }
        }
        return defaultValue;
    }

    saveData(filePath, data) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    }

    saveAll() {
        this.saveData(ITEMS_FILE, this.items);
        this.saveData(CLAIMS_FILE, this.claims);
        this.saveData(REVIEWS_FILE, this.reviews);
        this.saveData(MATCHES_FILE, this.matches);
    }

    generateId() {
        return Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }

    insertItem(item) {
        const id = this.generateId();
        const newItem = {
            id,
            ...item,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.items.push(newItem);
        this.saveData(ITEMS_FILE, this.items);
        return id;
    }

    getItem(id) {
        return this.items.find(i => i.id === id);
    }

    getAllItems() {
        return [...this.items];
    }

    updateItem(id, updates) {
        const index = this.items.findIndex(i => i.id === id);
        if (index === -1) return false;
        this.items[index] = {
            ...this.items[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        this.saveData(ITEMS_FILE, this.items);
        return true;
    }

    updateItemStatus(id, status) {
        return this.updateItem(id, { status });
    }

    insertClaim(claim) {
        const claimId = this.generateId();
        const newClaim = {
            claimId,
            ...claim,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.claims.push(newClaim);
        this.saveData(CLAIMS_FILE, this.claims);
        return claimId;
    }

    getClaim(claimId) {
        return this.claims.find(c => c.claimId === claimId);
    }

    getAllClaims() {
        return [...this.claims];
    }

    updateClaim(claimId, updates) {
        const index = this.claims.findIndex(c => c.claimId === claimId);
        if (index === -1) return false;
        this.claims[index] = {
            ...this.claims[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        this.saveData(CLAIMS_FILE, this.claims);
        return true;
    }

    updateClaimStatus(claimId, status) {
        return this.updateClaim(claimId, { status });
    }

    importClaims(claimsArray) {
        let imported = 0;
        let skipped = 0;
        
        for (const claim of claimsArray) {
            const existing = this.claims.find(c => 
                (claim.passengerName && c.passengerName === claim.passengerName && 
                 claim.flightNumber && c.flightNumber === claim.flightNumber)
            );
            
            if (existing) {
                skipped++;
                continue;
            }
            
            this.insertClaim(claim);
            imported++;
        }
        
        return { imported, skipped };
    }

    async importTagsFromCSV(csvPath) {
        return new Promise((resolve, reject) => {
            const results = [];
            let updated = 0;
            let created = 0;
            
            fs.createReadStream(csvPath)
                .pipe(csv())
                .on('data', (data) => results.push(data))
                .on('end', () => {
                    for (const row of results) {
                        const photoName = row.photoName || row.photo_name || row.照片名 || row.文件名;
                        const tags = (row.tags || row.标签 || '').split(/[,，]/).map(t => t.trim()).filter(t => t);
                        const description = row.description || row.描述 || '';
                        const foundDate = row.foundDate || row.发现日期 || row.日期 || '';
                        const location = row.location || row.地点 || row.位置 || '';
                        
                        let item = this.items.find(i => 
                            i.originalName === photoName || 
                            i.photoUrl.includes(photoName)
                        );
                        
                        if (item) {
                            this.updateItem(item.id, {
                                tags: tags.length > 0 ? tags : item.tags,
                                description: description || item.description,
                                foundDate: foundDate || item.foundDate,
                                location: location || item.location
                            });
                            updated++;
                        } else {
                            const id = this.insertItem({
                                photoUrl: '',
                                originalName: photoName || `item_${Date.now()}`,
                                tags,
                                description,
                                foundDate: foundDate || new Date().toISOString().split('T')[0],
                                location,
                                status: 'pending'
                            });
                            created++;
                        }
                    }
                    
                    resolve({ updated, created, total: results.length });
                })
                .on('error', reject);
        });
    }

    insertReview(review) {
        const reviewId = this.generateId();
        const newReview = {
            reviewId,
            ...review,
            createdAt: new Date().toISOString()
        };
        this.reviews.push(newReview);
        this.saveData(REVIEWS_FILE, this.reviews);
        return reviewId;
    }

    getAllReviews() {
        return [...this.reviews];
    }

    getReviewsByItem(itemId) {
        return this.reviews.filter(r => r.itemId === itemId);
    }

    getReviewsByClaim(claimId) {
        return this.reviews.filter(r => r.claimId === claimId);
    }

    saveMatchResult(itemId, claimId, matchResult) {
        const existingIndex = this.matches.findIndex(m => 
            m.itemId === itemId && m.claimId === claimId
        );
        
        const matchRecord = {
            itemId,
            claimId,
            ...matchResult,
            matchedAt: new Date().toISOString()
        };
        
        if (existingIndex >= 0) {
            this.matches[existingIndex] = {
                ...this.matches[existingIndex],
                ...matchRecord
            };
        } else {
            this.matches.push(matchRecord);
        }
        
        this.saveData(MATCHES_FILE, this.matches);
    }

    getAllMatchResults() {
        return [...this.matches];
    }

    getMatchesByItem(itemId) {
        return this.matches.filter(m => m.itemId === itemId);
    }

    getMatchesByClaim(claimId) {
        return this.matches.filter(m => m.claimId === claimId);
    }

    mergeClaims(sourceClaimIds, targetClaimId) {
        const targetClaim = this.getClaim(targetClaimId);
        if (!targetClaim) {
            return { success: false, error: 'Target claim not found' };
        }
        
        const mergedDescriptions = [targetClaim.description || ''];
        const mergedTags = [...(targetClaim.tags || [])];
        const mergedNotes = [targetClaim.notes || ''];
        
        for (const sourceId of sourceClaimIds) {
            const sourceClaim = this.getClaim(sourceId);
            if (sourceClaim) {
                if (sourceClaim.description && sourceClaim.description !== targetClaim.description) {
                    mergedDescriptions.push(sourceClaim.description);
                }
                if (sourceClaim.tags) {
                    for (const tag of sourceClaim.tags) {
                        if (!mergedTags.includes(tag)) {
                            mergedTags.push(tag);
                        }
                    }
                }
                if (sourceClaim.notes && sourceClaim.notes !== targetClaim.notes) {
                    mergedNotes.push(`[来自认领 ${sourceId.slice(0, 8)}]: ${sourceClaim.notes}`);
                }
                
                const sourceMatches = this.getMatchesByClaim(sourceId);
                for (const match of sourceMatches) {
                    this.saveMatchResult(match.itemId, targetClaimId, match);
                }
                
                const sourceReviews = this.getReviewsByClaim(sourceId);
                for (const review of sourceReviews) {
                    this.insertReview({
                        ...review,
                        claimId: targetClaimId,
                        notes: `[合并自认领 ${sourceId.slice(0, 8)}] ${review.notes || ''}`
                    });
                }
                
                this.updateClaim(sourceId, { 
                    status: 'merged', 
                    mergedInto: targetClaimId 
                });
            }
        }
        
        this.updateClaim(targetClaimId, {
            description: mergedDescriptions.filter(d => d).join(' | '),
            tags: mergedTags,
            notes: mergedNotes.filter(n => n).join('\n\n'),
            mergedFrom: sourceClaimIds
        });
        
        return { 
            success: true, 
            merged: sourceClaimIds.length, 
            targetClaimId 
        };
    }
}

module.exports = Database;
