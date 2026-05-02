const MatchingEngine = {
    matchAll() {
        const lostItems = DB.getLostItems().filter(item => item.status === 'pending');
        const foundItems = DB.getFoundItems().filter(item => item.status === 'pending');
        
        const allMatches = [];
        
        lostItems.forEach(lostItem => {
            foundItems.forEach(foundItem => {
                const matchResult = this.calculateMatchScore(lostItem, foundItem);
                if (matchResult.score >= 50) {
                    allMatches.push({
                        lostItem,
                        foundItem,
                        ...matchResult
                    });
                }
            });
        });

        allMatches.sort((a, b) => b.score - a.score);
        return allMatches;
    },

    matchItem(itemId, itemType) {
        let targetItem;
        let candidateItems;

        if (itemType === 'lost') {
            targetItem = DB.getLostItemById(itemId);
            candidateItems = DB.getFoundItems().filter(item => item.status === 'pending');
        } else {
            targetItem = DB.getFoundItemById(itemId);
            candidateItems = DB.getLostItems().filter(item => item.status === 'pending');
        }

        if (!targetItem) return [];

        const matches = [];
        candidateItems.forEach(candidate => {
            if (candidate.city !== targetItem.city) {
                return;
            }
            
            let matchResult;
            if (itemType === 'lost') {
                matchResult = this.calculateMatchScore(targetItem, candidate);
            } else {
                matchResult = this.calculateMatchScore(candidate, targetItem);
            }
            
            if (matchResult.score >= 40) {
                matches.push({
                    item: candidate,
                    itemType: itemType === 'lost' ? 'found' : 'lost',
                    ...matchResult
                });
            }
        });

        matches.sort((a, b) => b.score - a.score);
        return matches;
    },

    calculateMatchScore(lostItem, foundItem) {
        const factors = {
            category: 0,
            location: 0,
            time: 0,
            keywords: 0
        };
        const weights = {
            category: 0.3,
            location: 0.3,
            time: 0.2,
            keywords: 0.2
        };

        if (lostItem.category === foundItem.category) {
            factors.category = 100;
        } else {
            factors.category = 0;
        }

        if (lostItem.locationLat && lostItem.locationLng && 
            foundItem.locationLat && foundItem.locationLng) {
            const distance = Utils.calculateDistance(
                lostItem.locationLat, lostItem.locationLng,
                foundItem.locationLat, foundItem.locationLng
            );
            
            if (distance <= 1) {
                factors.location = 100;
            } else if (distance <= 3) {
                factors.location = 80;
            } else if (distance <= 5) {
                factors.location = 60;
            } else if (distance <= 10) {
                factors.location = 40;
            } else if (distance <= 20) {
                factors.location = 20;
            } else {
                factors.location = 0;
            }
        } else {
            const locationSimilarity = Utils.calculateTextSimilarity(
                lostItem.location || '',
                foundItem.location || ''
            );
            factors.location = locationSimilarity * 100;
        }

        const timeDiff = Math.abs((lostItem.time || lostItem.createTime) - (foundItem.time || foundItem.createTime));
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        
        if (hoursDiff <= 1) {
            factors.time = 100;
        } else if (hoursDiff <= 3) {
            factors.time = 85;
        } else if (hoursDiff <= 6) {
            factors.time = 70;
        } else if (hoursDiff <= 12) {
            factors.time = 50;
        } else if (hoursDiff <= 24) {
            factors.time = 30;
        } else if (hoursDiff <= 48) {
            factors.time = 15;
        } else {
            factors.time = 0;
        }

        const combinedLostText = [
            lostItem.title,
            lostItem.description,
            (lostItem.features || []).join(' ')
        ].filter(Boolean).join(' ');

        const combinedFoundText = [
            foundItem.title,
            foundItem.description,
            (foundItem.features || []).join(' ')
        ].filter(Boolean).join(' ');

        const keywordSimilarity = Utils.calculateTextSimilarity(combinedLostText, combinedFoundText);
        factors.keywords = keywordSimilarity * 100;

        let totalScore = 0;
        Object.keys(factors).forEach(key => {
            totalScore += factors[key] * weights[key];
        });

        return {
            score: Math.round(totalScore),
            factors
        };
    },

    createMatch(lostItemId, foundItemId, matchResult) {
        const match = {
            lostItemId,
            foundItemId,
            score: matchResult.score,
            matchFactors: matchResult.factors,
            status: 'pending_verification',
            createTime: Date.now()
        };

        const savedMatch = DB.saveMatch(match);

        const lostItem = DB.getLostItemById(lostItemId);
        if (lostItem) {
            lostItem.status = 'matched';
            lostItem.matchedId = savedMatch.id;
            DB.saveLostItem(lostItem);
        }

        const foundItem = DB.getFoundItemById(foundItemId);
        if (foundItem) {
            foundItem.status = 'matched';
            foundItem.matchedId = savedMatch.id;
            DB.saveFoundItem(foundItem);
        }

        return savedMatch;
    },

    getMatchDetails(matchId) {
        const match = DB.getMatchById(matchId);
        if (!match) return null;

        const lostItem = DB.getLostItemById(match.lostItemId);
        const foundItem = DB.getFoundItemById(match.foundItemId);
        const handover = DB.getHandoverByMatchId(matchId);

        return {
            match,
            lostItem,
            foundItem,
            handover
        };
    },

    confirmMatch(matchId) {
        const match = DB.getMatchById(matchId);
        if (match) {
            match.status = 'confirmed';
            DB.saveMatch(match);
        }
    },

    rejectMatch(matchId) {
        const match = DB.getMatchById(matchId);
        if (match) {
            match.status = 'rejected';
            DB.saveMatch(match);

            const lostItem = DB.getLostItemById(match.lostItemId);
            if (lostItem) {
                lostItem.status = 'pending';
                lostItem.matchedId = null;
                DB.saveLostItem(lostItem);
            }

            const foundItem = DB.getFoundItemById(match.foundItemId);
            if (foundItem) {
                foundItem.status = 'pending';
                foundItem.matchedId = null;
                DB.saveFoundItem(foundItem);
            }
        }
    }
};

function runMatch() {
    const select = document.getElementById('matchSelect');
    const selectedValue = select.value;
    
    if (!selectedValue) {
        Utils.showToast('请先选择要匹配的物品', 'error');
        return;
    }

    const [itemType, itemId] = selectedValue.split('|');
    const matches = MatchingEngine.matchItem(itemId, itemType);
    
    const resultsContainer = document.getElementById('match-results');
    
    if (matches.length === 0) {
        resultsContainer.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <div class="empty-state">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <h3>暂未找到匹配项</h3>
                        <p>系统会持续监控新发布的物品，有匹配时会自动提示</p>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    let html = '<h3 style="font-weight: 600; margin-bottom: 16px;">匹配结果</h3>';
    
    matches.forEach(match => {
        const item = match.item;
        const itemTypeLabel = match.itemType === 'lost' ? '失物' : '拾物';
        const categoryName = Utils.getCategoryName(item.category);
        const timeAgo = Utils.formatTime(item.time || item.createTime);

        html += `
            <div class="card" style="margin-bottom: 16px; cursor: pointer;" onclick="viewItemDetail('${match.itemType}', '${item.id}')">
                <div class="card-body">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                        <div>
                            <span class="tag ${match.itemType === 'lost' ? 'tag-lost' : 'tag-found'}">${itemTypeLabel}</span>
                            <span class="tag tag-category">${categoryName}</span>
                        </div>
                        <span class="match-score">${match.score}% 匹配</span>
                    </div>
                    <h4 style="font-weight: 600; margin-bottom: 8px;">${item.title}</h4>
                    <p style="color: #64748b; font-size: 14px; margin-bottom: 8px;">
                        <span>📍 ${item.location}</span>
                    </p>
                    <p style="color: #64748b; font-size: 14px;">
                        <span>⏰ ${timeAgo}</span>
                    </p>
                    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #f0f0f0;">
                        <p style="font-size: 14px; color: #64748b; margin-bottom: 8px;">匹配因素：</p>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                            <div style="background: #f8f9fa; padding: 8px 12px; border-radius: 8px;">
                                <span style="font-size: 12px; color: #64748b;">类别</span>
                                <div style="font-weight: 600;">${match.factors.category}%</div>
                            </div>
                            <div style="background: #f8f9fa; padding: 8px 12px; border-radius: 8px;">
                                <span style="font-size: 12px; color: #64748b;">地点</span>
                                <div style="font-weight: 600;">${match.factors.location}%</div>
                            </div>
                            <div style="background: #f8f9fa; padding: 8px 12px; border-radius: 8px;">
                                <span style="font-size: 12px; color: #64748b;">时间</span>
                                <div style="font-weight: 600;">${match.factors.time}%</div>
                            </div>
                            <div style="background: #f8f9fa; padding: 8px 12px; border-radius: 8px;">
                                <span style="font-size: 12px; color: #64748b;">关键词</span>
                                <div style="font-weight: 600;">${match.factors.keywords}%</div>
                            </div>
                        </div>
                    </div>
                    <div style="margin-top: 12px; display: flex; gap: 8px;">
                        <button class="btn btn-primary" style="flex: 1;" onclick="event.stopPropagation(); confirmMatchAction('${itemType}', '${itemId}', '${match.itemType}', '${item.id}', ${match.score})">确认匹配</button>
                        <button class="btn btn-secondary" style="flex: 1;" onclick="event.stopPropagation();">忽略</button>
                    </div>
                </div>
            </div>
        `;
    });

    resultsContainer.innerHTML = html;
    Utils.showToast(`找到 ${matches.length} 个潜在匹配`, 'success');
}

function confirmMatchAction(itemType1, itemId1, itemType2, itemId2, score) {
    let lostItemId, foundItemId;
    
    if (itemType1 === 'lost') {
        lostItemId = itemId1;
        foundItemId = itemId2;
    } else {
        lostItemId = itemId2;
        foundItemId = itemId1;
    }

    const match = MatchingEngine.createMatch(lostItemId, foundItemId, {
        score,
        factors: { category: 100, location: 80, time: 70, keywords: 60 }
    });

    Utils.showToast('匹配成功！请等待对方确认', 'success');
    navigateTo('list');
    refreshItemList();
}

function populateMatchSelect() {
    const select = document.getElementById('matchSelect');
    const lostItems = DB.getLostItemsByCity();
    const foundItems = DB.getFoundItemsByCity();

    let options = '<option value="">请选择要匹配的物品...</option>';
    
    options += '<optgroup label="失物">';
    lostItems.forEach(item => {
        const timeAgo = Utils.formatTime(item.time || item.createTime);
        options += `<option value="lost|${item.id}">📌 ${item.title} - ${timeAgo}</option>`;
    });
    options += '</optgroup>';
    
    options += '<optgroup label="拾物">';
    foundItems.forEach(item => {
        const timeAgo = Utils.formatTime(item.time || item.createTime);
        options += `<option value="found|${item.id}">📍 ${item.title} - ${timeAgo}</option>`;
    });
    options += '</optgroup>';

    select.innerHTML = options;
}
