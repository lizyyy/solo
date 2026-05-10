const SensitiveScanner = {
    scan: function(scheduleData) {
        const result = {
            status: CHECK_STATUS.PASS,
            input: {},
            output: {},
            failures: [],
            matches: []
        };

        const programs = scheduleData.programs || [];

        result.input = {
            programCount: programs.length,
            programs: programs.map(p => ({
                title: p.title,
                contentLength: p.content ? p.content.length : 0
            })),
            dictionarySize: SENSITIVE_WORDS.length
        };

        let totalMatches = 0;

        programs.forEach((program, index) => {
            const programMatches = this.scanProgram(program, index);
            if (programMatches.length > 0) {
                totalMatches += programMatches.length;
                result.matches.push({
                    programIndex: index + 1,
                    programId: program.id,
                    programTitle: program.title,
                    matches: programMatches
                });
                result.status = CHECK_STATUS.FAIL;

                programMatches.forEach(match => {
                    result.failures.push({
                        program: program.title,
                        type: ISSUE_TYPE.SENSITIVE_WORD,
                        message: `节目「${program.title}」中发现敏感词「${match.word}」`,
                        word: match.word,
                        position: match.position,
                        context: match.context
                    });
                });
            }
        });

        result.output = {
            totalMatches: totalMatches,
            affectedPrograms: result.matches.length,
            cleanPrograms: programs.length - result.matches.length
        };

        return result;
    },

    scanProgram: function(program, programIndex) {
        const matches = [];
        const content = program.content || '';
        const title = program.title || '';
        const fullText = title + ' ' + content;

        SENSITIVE_WORDS.forEach(word => {
            let searchIndex = 0;
            while (searchIndex < fullText.length) {
                const position = fullText.indexOf(word, searchIndex);
                if (position === -1) break;

                const contextStart = Math.max(0, position - 20);
                const contextEnd = Math.min(fullText.length, position + word.length + 20);
                let context = fullText.substring(contextStart, contextEnd);

                if (contextStart > 0) context = '...' + context;
                if (contextEnd < fullText.length) context = context + '...';

                const highlightedContext = this.highlightWord(context, word);

                matches.push({
                    word: word,
                    position: position,
                    context: context,
                    highlightedContext: highlightedContext,
                    inTitle: position < title.length
                });

                searchIndex = position + word.length;
            }
        });

        return matches;
    },

    highlightWord: function(text, word) {
        const regex = new RegExp(word, 'g');
        return text.replace(regex, `<span class="sensitive-highlight">${word}</span>`);
    },

    formatResult: function(result) {
        const lines = [];
        lines.push(`输入: ${result.input.programCount}个节目，敏感词库${result.input.dictionarySize}个词`);
        lines.push(`输出: 发现${result.output.totalMatches}个敏感词，涉及${result.output.affectedPrograms}个节目`);

        if (result.failures.length > 0) {
            lines.push('失败原因:');
            const grouped = {};
            result.failures.forEach(f => {
                if (!grouped[f.program]) {
                    grouped[f.program] = [];
                }
                grouped[f.program].push(f.word);
            });
            Object.keys(grouped).forEach(program => {
                lines.push(`  ❌ 节目「${program}」: ${grouped[program].join('、')}`);
            });
        }

        return lines.join('\n');
    }
};
