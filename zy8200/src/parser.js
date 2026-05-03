const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const yaml = require('js-yaml');

class Parser {
  static async parseFormulaCsv(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          const ingredient = {
            name: data.name || data['名称'] || data['成分名称'],
            inciName: data.inciName || data['INCI名称'] || null,
            percentage: parseFloat(data.percentage || data['含量'] || data['百分比']) || 0,
            role: data.role || data['作用'] || null,
            isFragrance: (data.isFragrance || data['是否香精'] || 'false').toLowerCase() === 'true'
          };
          results.push(ingredient);
        })
        .on('end', () => resolve(results))
        .on('error', (error) => reject(error));
    });
  }

  static parseInciDictionary(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = yaml.load(content);
    
    const inciMap = new Map();
    const aliases = new Map();
    
    if (data && data.inciNames) {
      data.inciNames.forEach(item => {
        const standardName = item.standardName;
        inciMap.set(standardName.toLowerCase(), {
          standardName: item.standardName,
          casNumber: item.casNumber,
          description: item.description,
          aliases: item.aliases || []
        });
        
        if (item.aliases && Array.isArray(item.aliases)) {
          item.aliases.forEach(alias => {
            aliases.set(alias.toLowerCase(), standardName);
          });
        }
      });
    }
    
    return { inciMap, aliases };
  }

  static parsePackLabel(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/).map(line => line.trim()).filter(line => line);
    
    let inIngredientsSection = false;
    const ingredients = [];
    
    for (const line of lines) {
      if (/^[【\[]?(成分|配料|Ingredients|INCI)[】\]]?:?$/i.test(line)) {
        inIngredientsSection = true;
        continue;
      }
      
      if (inIngredientsSection) {
        if (line.startsWith('(') || /^[【\[]?(注意|说明|Warning|Note|使用方法|保质期|生产批号)/i.test(line)) {
          inIngredientsSection = false;
          continue;
        }
        
        const names = line.split(/[,，、]/).map(name => name.trim()).filter(name => name);
        ingredients.push(...names);
      }
    }
    
    return {
      rawContent: content,
      ingredients: ingredients,
      fullText: content
    };
  }

  static parseAllergenRules(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    
    return {
      allergens: data.allergens || [],
      threshold: data.threshold || 0.001,
      labelingRequirements: data.labelingRequirements || {
        mustLabel: true,
        location: 'ingredients_list',
        format: 'parentheses'
      },
      restrictedIngredients: data.restrictedIngredients || []
    };
  }

  static normalizeName(name) {
    if (!name) return '';
    return name.toLowerCase().trim();
  }
}

module.exports = Parser;
