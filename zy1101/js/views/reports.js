const ReportsView = {
    init: function() {
        this.bindEvents();
    },
    
    bindEvents: function() {
        const btnMarkdown = document.getElementById('btnExportMarkdown');
        const btnHTML = document.getElementById('btnExportHTML');
        
        if (btnMarkdown) {
            btnMarkdown.addEventListener('click', () => {
                ImportExport.downloadMarkdown();
            });
        }
        
        if (btnHTML) {
            btnHTML.addEventListener('click', () => {
                ImportExport.downloadHTML();
            });
        }
    },
    
    render: function() {
        const reportPreview = document.getElementById('reportPreview');
        if (!reportPreview) return;
        
        const markdown = ImportExport.exportToMarkdown();
        reportPreview.innerHTML = this.markdownToPreviewHTML(markdown);
    },
    
    markdownToPreviewHTML: function(markdown) {
        if (!markdown) return '';
        
        let html = '';
        const lines = markdown.split('\n');
        let inTable = false;
        let tableRows = [];
        let inList = false;
        let listItems = [];
        
        lines.forEach(line => {
            line = line.trim();
            
            if (line.startsWith('# ')) {
                if (inTable) {
                    html += this.renderTable(tableRows);
                    inTable = false;
                    tableRows = [];
                }
                if (inList) {
                    html += `<ul>${listItems.join('')}</ul>`;
                    inList = false;
                    listItems = [];
                }
                html += `<h1>${line.slice(2)}</h1>`;
            } else if (line.startsWith('## ')) {
                if (inTable) {
                    html += this.renderTable(tableRows);
                    inTable = false;
                    tableRows = [];
                }
                if (inList) {
                    html += `<ul>${listItems.join('')}</ul>`;
                    inList = false;
                    listItems = [];
                }
                html += `<h2>${line.slice(3)}</h2>`;
            } else if (line.startsWith('### ')) {
                if (inTable) {
                    html += this.renderTable(tableRows);
                    inTable = false;
                    tableRows = [];
                }
                if (inList) {
                    html += `<ul>${listItems.join('')}</ul>`;
                    inList = false;
                    listItems = [];
                }
                html += `<h3>${line.slice(4)}</h3>`;
            } else if (line.startsWith('---')) {
                if (inTable) {
                    html += this.renderTable(tableRows);
                    inTable = false;
                    tableRows = [];
                }
                if (inList) {
                    html += `<ul>${listItems.join('')}</ul>`;
                    inList = false;
                    listItems = [];
                }
                html += `<hr>`;
            } else if (line.startsWith('| ')) {
                inList = false;
                if (!inTable) {
                    inTable = true;
                    tableRows = [];
                }
                tableRows.push(line);
            } else if (line.startsWith('- ') || line.startsWith('* ')) {
                if (inTable) {
                    html += this.renderTable(tableRows);
                    inTable = false;
                    tableRows = [];
                }
                inList = true;
                let itemText = line.slice(2);
                itemText = itemText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                listItems.push(`<li>${itemText}</li>`);
            } else if (line === '') {
                if (inTable) {
                    html += this.renderTable(tableRows);
                    inTable = false;
                    tableRows = [];
                }
                if (inList) {
                    html += `<ul>${listItems.join('')}</ul>`;
                    inList = false;
                    listItems = [];
                }
            } else {
                if (inTable) {
                    html += this.renderTable(tableRows);
                    inTable = false;
                    tableRows = [];
                }
                if (inList) {
                    html += `<ul>${listItems.join('')}</ul>`;
                    inList = false;
                    listItems = [];
                }
                
                line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                line = line.replace(/🔴/g, '<span style="color: #dc2626; font-weight: bold;">🔴</span>');
                line = line.replace(/🟡/g, '<span style="color: #d97706; font-weight: bold;">🟡</span>');
                line = line.replace(/🟢/g, '<span style="color: #2563eb; font-weight: bold;">🟢</span>');
                
                html += `<p>${line}</p>`;
            }
        });
        
        if (inTable) {
            html += this.renderTable(tableRows);
        }
        if (inList) {
            html += `<ul>${listItems.join('')}</ul>`;
        }
        
        return html;
    },
    
    renderTable: function(rows) {
        if (rows.length < 2) return '';
        
        const isSeparator = rows[1].startsWith('|---') || rows[1].startsWith('|:-');
        
        let html = '<table>\n';
        
        if (isSeparator) {
            const headers = this.parseTableRow(rows[0]);
            html += '<thead><tr>';
            headers.forEach(h => {
                html += `<th>${h}</th>`;
            });
            html += '</tr></thead>\n';
            
            html += '<tbody>\n';
            for (let i = 2; i < rows.length; i++) {
                const cells = this.parseTableRow(rows[i]);
                html += '<tr>';
                cells.forEach(c => {
                    let cellHtml = c;
                    cellHtml = cellHtml.replace(/✗/g, '❌');
                    cellHtml = cellHtml.replace(/✓/g, '✅');
                    cellHtml = cellHtml.replace(/○/g, '⚪');
                    html += `<td>${cellHtml}</td>`;
                });
                html += '</tr>\n';
            }
            html += '</tbody>\n';
        }
        
        html += '</table>\n';
        return html;
    },
    
    parseTableRow: function(row) {
        const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
        return cells;
    }
};

window.ReportsView = ReportsView;
