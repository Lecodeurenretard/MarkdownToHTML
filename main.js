var specialChars = {
    '<': '&lt;',
    '>': '&gt;',
    '#': '&#35;',
    '*': '&#42;',
    '_': '&#45;',
};

/**
 * Protected access to `specialChar`.
 * @param {string} char 
 * @returns {string} `specialChars[char]` if `char` is in `specialChars` else `char`.
 */
function correspondingSpecialChar(char) {
    if(char in specialChars) {
        return specialChars[char];
    }
    return char;
}

/**
 * Convert markdown to HTML
 * @param {string} text The text to convert to HTML
 */
function markdownToHMTL(text) {
    var res = '';
    var openedTxtArea = 0;
    for (let i = 0; i < text.length; i++) {
        i = parseInt(i);    //I love JS
        let lastChar = null;
        let nextChar = null;

        if(i > 0) { lastChar = text[i-1]; }
        if(i+1 < text.length) { nextChar = text[i+1]; }
        let currentChar = text[i];

        const isFirstChar = lastChar == '\n' || i == 0;   //if currentChar is the first character of the line

        if(currentChar == '\\') {
            if(!nextChar) {
                res += '\\';
                break;
            }

            res += correspondingSpecialChar(nextChar);
            i++
            continue;
        }

        //preventing XSS injections (The user can output HTML but only in <output>)
        if(currentChar == '<') {
            const sliced = text.slice(i, i+9+1);
            if(sliced.slice(0, -2) == "<output>") {
                openedTxtArea++;
                res += "<output>";
                
                i += 7;     //skipping the <output>
                continue; 
            }
            if (sliced == "</output>") {
                if(openedTxtArea <= 0) {
                    throw new Error("Trying to close the <output> element without any opened.");
                }
                openedTxtArea--;
                res += "</output>";

                i += 8;
                continue;
            }
        }

        if(isFirstChar && currentChar == '#') {
            let j = i;
            let headingDepth = 1;
            while(text[++j] == '#') {
                headingDepth++;
            }
            if(headingDepth > 6) {  //there is no <h7>
                headingDepth = 6;
                console.warn(`There is more than 6 \`#\` for a heading, outputting an <h6>`)
            }
            headingDepth = Math.min(headingDepth, 6);       

            if(text[j] == ' ') {  //if not a space, it will be handled as \#
                i = j;
                let buf = '';
                while(text[++i] != '\n' && i < text.length) {
                    currentChar = text[i];
                    nextChar    = text[i+1];
                    if((nextChar == '<' || nextChar == '>') && currentChar != '\\') {     //check if a '<' or '>' is not escaped
                        throw new Error(`Unsecaped \`${nextChar}\` in heading, HTML is disabled in headings.`);
                    }
                    if(currentChar == '<') {
                        buf = buf.slice(0, -1) + specialChars['<'];
                        continue;
                    }
                    if(currentChar == '>') {
                        buf = buf.slice(0, -1) + specialChars['>'];
                        continue;
                    }
                        
                    buf += correspondingSpecialChar(currentChar);
                }
                res += `<h${headingDepth}>${buf}</h${headingDepth}>\n`;
            }
            continue;
        }

        //else it is text
        let spaces = 0
        while(text[i] == ' ' && i < text.length){
            spaces++;
            i++;
        }

        currentChar = text[i];
        if(spaces > 1 && currentChar == '\n') {
            res += "<br />\n"
            continue;
        }
        //else
        res += ' '.repeat(spaces);  //insert spaces
        
        res += currentChar;
    }
    return res;
}