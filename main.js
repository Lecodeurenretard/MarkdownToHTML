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
 * Parse titles from `text[pos]`.
 * @param {string} text The complete text passed from the user
 * @param {Number} pos Where to begin parsing
 * @returns {[string, Number]} An array containing the parsing result and the end position of the parsing function.
 */
function parseTitles(text, pos) {
    let j = pos;
    let headingDepth = 1;
    let res = '';

    while(text[++j] == '#') {
        headingDepth++;
    }
    if(headingDepth > 6) {  //there is no <h7>
        headingDepth = 6;
        console.warn(`There is more than 6 \`#\` for a heading, outputting an <h6>`)
    }
    headingDepth = Math.min(headingDepth, 6);       

    if(text[j] == ' ') {  //if not a space, the # will be handled as \#
        pos = j;
        let buf = '';
        while(text[++pos] != '\n' && pos < text.length) {
            currentChar = text[pos];
            nextChar    = text[pos+1];

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
                pos++;    //skipping the second *
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
    return [res, pos];
}

/**
 * Return a string closing `howMany` blockquotes.
 * @param {Number} howMany How many blockquotes should the function close
 * @returns {string} 
 */
function closeBlockQuotes(howMany) {
    return "</blockquote>\n".repeat(howMany);
}

/**
 * Parse one line of a blockquote.
 * @param {string} text The complete text passed from the user
 * @param {Number} pos Where to begin parsing
 * @param {Number} quotingDepth The current nesting depth of quoting blocks. 
 * @returns {[string, Number, Number]} An array containing the parsing result, the end position of the parsing function and the new quoting depth in this order.
 */
function parseBlockQuotes(text, pos, quotingDepth) {
    let depth = 0;
    let res = '';
    while(text[pos] == '>') {
        depth++;
        pos++;
    }
    if(text[pos] != ' ') {
        res += closeBlockQuotes(quotingDepth);
        console.warn("Blockquotes ended because a line didn't have a space after `>` characters.");
        
        res += specialChars['>'].repeat(depth);
        return [res, pos-1, 0];    //cancelling the continue's effect
    }
    if(depth > quotingDepth+1) {
        throw new Error(`Can't quote at a nesting level of ${depth} when the previous line's nesting level was ${quotingDepth}.`);
    }
            
    if(depth == quotingDepth+1) {
        res += "<blockquote>";
        quotingDepth++;
        return [res, pos, quotingDepth];
    }
    if(depth < quotingDepth) {
        res += closeBlockQuotes(quotingDepth - depth);        
        quotingDepth = depth;
    }

    res += "<br />\n";
    return [res, pos, quotingDepth]
}

/**
 * Parse styles:
 * + italic
 * + bold
 * @param {string} text The complete text passed from the user
 * @param {Number} pos Where to begin parsing
 * @returns {[string, Number, boolean]} Return an array which contains: the parsing result, the end position of the parsing function and a boolean indicating the success of the function in finding a style to apply (whether or not the loop should use `continue`).
 */
function parseStyle(text, pos) {
    //asterix bold
    if(text[pos] == '*' && text[pos+1] == '*') 
        return [correspondingStyleTag('**'), pos+1, true];      //skipping the second *

    //asterix italic
    if(text[pos] == '*') 
        return [correspondingStyleTag('*'), pos, true];
    return ['', pos, false];
}

/**
 * Check if a marker is at `text[pos]`.
 * @param {string} text The complete text passed from the user
 * @param {Number} pos Where to begin checking
 * @returns {[boolean, Number]} Return the result of the text and the position of the character after the marker.
 */
function checkOrderedList(text, pos) {
    if(!/\d/.test(text[pos])) 
        return [false, pos];

    while(/\d/.test(text[pos])) {   //skipping all nums
        pos++;
    }
    return [text[pos] == '.', pos+1];
}

/**
 * Parse ordered lists.
 * @param {string} text The complete text passed from the user
 * @param {Number} pos Where to begin parsing
 * @param {Number} lastIndex=0 | The last index used for this list 
 * @returns {[string, Number]} An array containing the parsing result, the end position of the parsing function.
 */
function parseOrderedList(text, pos) {
    let res = "<ol>\n<li>";

    let newIteration;
    [newIteration, pos] = checkOrderedList(text, pos);
    for(; text[pos] !== undefined; pos++) {
        let currentChar     = text[pos];
        let nextChar        = text[pos+1] ?? null;
        let previousChar    = text[pos-1] ?? null;

        const isFirstChar = previousChar == '\n';   //pos == 0 case is handled before the loop 
        if(isFirstChar) {
            const [hereWeGoAgain, newPos] = checkOrderedList(text, pos);
            pos = newPos
           if(!hereWeGoAgain) 
                break;

           res += "</li>\n<li>";
           continue;
        }

        if(currentChar == '\\') {
            if(!nextChar) {
                res += '\\';
                break;
            }

            res += correspondingSpecialChar(nextChar);
            pos++
            continue;
        }

        if(currentChar == '<' || currentChar == '>')    //escaped < and > are handled above
            throw new Error("Can't insert HTML into lists, try to escape `<` and `>`.");

        //parse style
        {
            let parseRes, callContinue;
            [parseRes, pos, callContinue] = parseStyle(text, pos);
            res += parseRes;
            if(callContinue)
                continue;
        }

        //else it's regular text
        let newLines = 0;
        while(currentChar == '\n' && pos < text.length) {
            newLines++;
            currentChar = text[++pos];
        }
        if(newLines > 0) {
            if(newLines > 1) {      //new paragraph
                res += "<br />\n<br />\n";
            }
            pos--;    //cancel the continue's effect 
            continue;
        }

        let spaces = 0
        while(currentChar == ' ' && pos < text.length) {
            spaces++;
            currentChar = text[++pos];
        }
        if(spaces > 0) {
            if(spaces > 1 && currentChar == '\n') {
                res += "<br />\n";
            }
            res += ' '.repeat(spaces);  //insert spaces
            pos--;
            continue;
        }
        
        //If not at EoF
        if (currentChar)
            res += currentChar;            
    }
    res += "</li></ol>";
    return [res, pos]
}

/**
 * Convert markdown to HTML
 * @param {string} text The text to convert to HTML
 */
function markdownToHMTL(text) {
    var res = '';
    var openedTxtArea = 0;
    var quotingDepth = 0;
    var quoted = false;
    var listLastIndex = 0;

    for (let i = 0; i < text.length; i++) {
        i = parseInt(i);    //I love JS
        let previousChar = null;
        let nextChar = null;

        if(i > 0) { previousChar = text[i-1]; }
        if(i+1 < text.length) { nextChar = text[i+1]; }
        let currentChar = text[i];

        const isFirstChar = previousChar == '\n' || i == 0 || quoted;   //if currentChar is the first character of the line

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
        
        //blockquotes
        if(isFirstChar && currentChar == '>') {
            let parseRes = '';
            [parseRes, i, quotingDepth] = parseBlockQuotes(text, i, quotingDepth);
            res += parseRes;
        
            quoted = true;  //setting newLine to true
            continue;
        }
        if(isFirstChar && !quoted && quotingDepth > 0) {   //=> currentChar != '>'
            res += closeBlockQuotes(quotingDepth);
            quotingDepth = 0;
            console.info("Setting blockquote nesting level to 0");
        }
        quoted = false; //resetting quoted so `isFirstChar` isn't always true

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
            let parseRes;
            [parseRes, i] = parseTitles(text, i);
            res += parseRes;
            continue;
        }

        //lists
        {
            const [testRes, newPos] = checkOrderedList(text, i);
            i = newPos;
            if(testRes) {
                let parseRes;
                [parseRes, i, listLastIndex] = parseOrderedList(text, i, listLastIndex);
                res += parseRes;
                continue;
            }
        }
        
        //parse style
        {
            let parseRes, callContinue;
            [parseRes, i, callContinue] = parseStyle(text, i);
            res += parseRes;
            if(callContinue)
                continue;
        }    

        //else it's regular text
        let newLines = 0;
        while(currentChar == '\n' && i < text.length) {
            newLines++;
            currentChar = text[++i];
        }
        if(newLines > 0) {
            if(newLines > 1)      //new paragraph
                res += "<br />\n<br />\n";
            i--;    //cancel the continue's effect 
            continue;
        }

        let spaces = 0
        while(currentChar == ' ' && i < text.length) {
            spaces++;
            currentChar = text[++i];
        }
        if(spaces > 0) {
            if(spaces > 1 && currentChar == '\n')
                res += "<br />\n";

            res += ' '.repeat(spaces);  //insert spaces
            i--;
            continue;
        }
        
        //If not at EoF
        if (currentChar)
            res += currentChar;            
        
    }

    res += closeBlockQuotes(quotingDepth);
    return res;
}