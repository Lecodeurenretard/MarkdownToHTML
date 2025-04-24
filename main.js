const specialChars = {
    '<': '&lt;',
    '>': '&gt;',
    '#': '&#35;',
    '*': '&#42;',
    '_': '&#45;',
};

const styleChar = {
    '*': "italic",
    '**': "bold",
};

var openedStyle = {
    "italic": false,
    "bold": false,
}

const styleTagNames = {
    "italic": "i",
    "bold": "b",
}

/**
 * The tag corresponding to `char`.
 * @param {string} char The string representing a style, for bold it would be `'**'`. It is assumed that it is a key of `styleChar`.
 * @returns {string} 
 */
function correspondingStyleTag(char) {
    const tagName = styleTagNames[styleChar[char]];
    if(openedStyle[styleChar[char]]) {  //if the corresponding style has been opened 
        openedStyle[styleChar[char]] = false;
        return "</" + tagName + ">";
    }
    
    openedStyle[styleChar[char]] = true;
    return "<" + tagName + ">";
} 

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
        let previousChar = null;
        let nextChar = null;

        if(i > 0) { previousChar = text[i-1]; }
        if(i+1 < text.length) { nextChar = text[i+1]; }
        let currentChar = text[i];

        const isFirstChar = previousChar == '\n' || i == 0;   //if currentChar is the first character of the line

        //handling escapes
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

        //titles
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

            if(text[j] == ' ') {  //if not a space, the # will be handled as \#
                i = j;
                let buf = '';
                while(text[++i] != '\n' && i < text.length) {
                    currentChar = text[i];
                    nextChar    = text[i+1];

                    //checking for tags
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

                    //asterix bold
                    if(currentChar == '*' && nextChar == '*') {
                        buf += correspondingStyleTag('**');
                        i++;    //skipping the second *
                        continue;
                    }

                    //asterix italic
                    if(currentChar == '*') {
                        buf += correspondingStyleTag('*');
                        continue;
                    }
                        
                    buf += correspondingSpecialChar(currentChar);
                }
                res += `<h${headingDepth}>${buf}</h${headingDepth}>\n`;
            }
            continue;
        }

        //asterix bold
        if(currentChar == '*' && nextChar == '*') {
            res += correspondingStyleTag('**');
            i++;    //skipping the second *
            continue;
        }

        //asterix italic
        if(currentChar == '*') {
            res += correspondingStyleTag('*');
            continue;
        }

        //else it's regular text
        let newLines = 0;
        while(currentChar == '\n' && i < text.length){
            newLines++;
            currentChar = text[++i];
        }
        if(newLines > 0){
            if(newLines > 1) {      //new paragraph
                res += "<br />\n<br />\n";
            }
            i--;    //cancel the continue's effect 
            continue;
        }

        let spaces = 0
        while(currentChar == ' ' && i < text.length){
            spaces++;
            currentChar = text[++i];
        }
        if(spaces > 0) {
            if(spaces > 1 && currentChar == '\n'){
                res += "<br />\n";
            }
            res += ' '.repeat(spaces);  //insert spaces
            i--;
            continue;
        }
        
        //If not at EoF
        if (currentChar) {
            res += currentChar;            
        }
    }
    return res;
}