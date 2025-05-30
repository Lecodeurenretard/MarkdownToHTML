class MarkdownParser {
	/**
	 * The parsing result;
	 * @type {string}
	 */
	#result = '';

	/**
	 * An iterator of `toParse`. In documentation it is referred as _the iterator_.
	 * @type {Number}
	 */
	#position = 0;

	/**
	 * The text to parse.
	 * @type {string}
	 */
	#toParse = '';

	/**
	 * The character at position `#position` in `#toParse`.
	 * @type {string}
	 */
	#currentChar = '';

	/**
	 * The character at position `#position+1` in `#toParse`.
	 * @type {string}
	 */
	#nextChar = '';

	/**
	 * The character at position `#position-1` in `#toParse`.
	 * @type {string}
	 */
	#previousChar = '';

	/**
	 * How many output tags were opened.
	 * @type {Number}
	 */
	#openedOutputTag = 0;

	static specialChars = {
		'<': '&lt;',
		'>': '&gt;',
		'#': '&#35;',
		'*': '&#42;',
		'_': '&#45;',
	};

	static #styleChar = {
		'*': "italic",
		'**': "bold",
	};

	#openedStyle = {
		"italic": false,
		"bold": false,
	}

	static #styleTagNames = {
		"italic": "i",
		"bold": "b",
	}

	/**
	 * @typedef {Number} ListEnum A member of the enum `ListEnum`.
	 */
	/**
	 * An enum (object) containing all type of lists.
	 * @type {Object}
	 */
	static ListEnum = Object.freeze({
		notAList: -1,	//-1 put it last in alphabetical order
		ordered: 1,
		unordered: 2
	});

	/**
	 * Contain tags of all list types.
	 * @type {Object}
	 */
	static listTag = {};	//initialized in constructor

	/**
	 * Contains callbacks for all lists, none of them change the iterator's position except if they succeed.
	 * @type {Object}
	 */
	listCheckCallback = {};	//initialized in constructor
	

	static initialized = false;
	/**
	 * Initialize static members.
	 */
	static initStatic() {
		if(this.initialized)
			return;

		MarkdownParser.listTag[MarkdownParser.ListEnum.notAList]	= undefined;
		MarkdownParser.listTag[MarkdownParser.ListEnum.ordered]		= "ol";
		MarkdownParser.listTag[MarkdownParser.ListEnum.unordered]	= "ul";
		
		MarkdownParser.listTag = Object.freeze(MarkdownParser.listTag);
		this.initialized = true;
	}

	constructor() {
		this.listCheckCallback[MarkdownParser.ListEnum.notAList]	= () => true;
		this.listCheckCallback[MarkdownParser.ListEnum.ordered]		= () => this.#checkOrderedList();
		this.listCheckCallback[MarkdownParser.ListEnum.unordered]	= () => {
			if(this.#currentChar == '-' && this.#nextChar == ' ') {
				this.#skip();
				return true;
			}
			return false;
		};

		this.listCallback = Object.freeze(this.listCheckCallback);
	}

	/**
	 * Check if `#position` is out of bounds for `#toParse`.
	 * @returns {boolean}
	 */
	isAtEndOfText(/*void*/) {
		return this.#toParse[this.#position] === undefined;
	}

	/**
	 * Update `#previousChar`, `#currentChar` and `#nextChar`.
	 */
	#updateChars(/*void*/) {
		this.#previousChar	= this.#toParse[this.#position-1];
		this.#currentChar	= this.#toParse[this.#position];
		this.#nextChar		= this.#toParse[this.#position+1];
	}

	/**
	 * Move `howMuch` chars in `#toParse`, call `#updateChars()`.
	 * @param {Number} [howMuch=1] A positive integer.
	 * @returns {string} The new `#currentChar`.
	 */
	#skip(howMuch=1) {
		if(howMuch < 0)
			throw new RangeError("Parameter `howMuch` is negative.");
		this.#position += howMuch;
		this.#updateChars();
		return this.#currentChar;
	}

	/**
	 * Shift the iterator to `index`.
	 * @param {Number} index The index to go to.
	 * @returns {string} `#currentChar`.
	 */
	#skipTo(index) {
		if(index < this.#position)
			throw new RangeError("`index` is before the iterator's position in `skipTo("+ index.toString() +")`.");
		return this.#skip(index - this.#position);
	}

	/**
	 * Move back the iterator 1 letter. This method should only be used to cancel a `continue`'s effect.
	 */
	#goBack(/*void*/) {
		this.#position--;
		this.#updateChars();
	}

	/**
	 * Count the indentation there is from the iterator location. Change `#position`.
	 * @param {Number} [spacesInTabs=4] How many spaces are equivalent to a tab (one of indentation).
	 * @returns {Number} Return the indentation level.
	 */
	#countIndentation(spacesInTabs=4) {
		const spaceVal = 1/spacesInTabs;	//If a tab is 4 spaces, a spaces is 1/4 tab,  if a tab is 8 spaces, a spaces is 1/8 tab, ...
		let count = 0;
		for(; !this.isAtEndOfText(); this.#skip()) {
			if(this.#currentChar == '\t') {
				count++;
				continue;
			}
			if(this.#currentChar == ' ') {
				count += spaceVal;
				continue;
			}
			break;
		}
		return Math.floor(count);
	}

	/**
	 * The tag corresponding to `char`.
	 * @param {string} char The string representing a style, for bold it would be `'**'`. It is assumed that it is a key of `#styleChar`.
	 * @returns {string} 
	 */
	correspondingStyleTag(char) {
		const tagName = MarkdownParser.#styleTagNames[MarkdownParser.#styleChar[char]];
		if(this.#openedStyle[MarkdownParser.#styleChar[char]]) {	//if the corresponding style has been opened 
			this.#openedStyle[MarkdownParser.#styleChar[char]] = false;	//set it to closed
			return "</" + tagName + ">";
		}
		
		this.#openedStyle[MarkdownParser.#styleChar[char]] = true;
		return "<" + tagName + ">";
	} 

	/**
	 * Safe access to `#specialChar`.
	 * @param {string} char 
	 * @returns {string} `#specialChars[char]` if `char` is in `specialChars` else `char`.
	 */
	static correspondingSpecialChar(char) {
		if(char in MarkdownParser.specialChars)
			return MarkdownParser.specialChars[char];
		return char;
	}

	/**
	 * Parse regular text (not including styles) from the iterator location.
	 * @returns {boolean} Return if the function found a new paragraph.
	 */
	#parseRegularText(/*void*/) {
		let spaces = 0;
		while(this.#currentChar == ' ' && !this.isAtEndOfText()) {
			spaces++;
			this.#skip();
		}
		
		if(spaces > 1 && this.#currentChar == '\n'){
			this.#result += "<br />\n";
			return false;
		}
		if(spaces > 0) {
			this.#result += ' '.repeat(spaces);	//insert spaces
			this.#goBack();
			return false;
		}

		let newLines = 0;
		while(this.#currentChar == '\n' && !this.isAtEndOfText()) {
			newLines++;
			this.#skip();
		}
		if(newLines > 0) {	//if new line, getting ready for a new marker
			this.#goBack();
			return newLines > 1;
		}

		//If not at EoF
		if (!this.isAtEndOfText())
			this.#result += this.#currentChar;
		return false;
	}

	/**
	 * Parse titles from the iterator's position.
	 */
	#parseTitles(/*void*/) {
		let posCopy = this.#position;
		let headingDepth = 1;

		while(this.#toParse[++posCopy] == '#')
			headingDepth++;

		if(headingDepth > 6) {	//there is no <h7>
			headingDepth = 6;
			console.warn(`There is more than 6 \`#\` for a heading, outputting an <h6>`);
		}

		if(this.#toParse[posCopy] != ' ')	//if not a space, the # will be handled as \# by another function.
			return;

		this.#result += `<h${headingDepth}>`;
		this.#skipTo(posCopy);
		while(this.#skip() != '\n' && !this.isAtEndOfText()) {
			//checking for tags
			if(this.#nextChar == '<' || this.#nextChar == '>') {
				if(this.#currentChar != '\\')		//check if a '<' or '>' is not escaped
					throw new Error(`Unsecaped \`${nextChar}\` in heading, HTML is disabled in headings.`);

				this.#skip();
				if(this.#currentChar == '<') {
					this.#result += MarkdownParser.specialChars['<'];
					continue;
				}
				//else #currentChar == '>'
				this.#result += MarkdownParser.specialChars['>'];
				continue;
			}

			//asterix bold
			if(this.#currentChar == '*' && this.#nextChar == '*') {
				this.#result += this.correspondingStyleTag('**');
				this.#skip();	//skipping the second *
				continue;
			}

			//asterix italic
			if(this.#currentChar == '*') {
				this.#result += this.correspondingStyleTag('*');
				continue;
			}

			this.#result += MarkdownParser.correspondingSpecialChar(this.#currentChar);
		}
		this.#result += `</h${headingDepth}>\n`;
	}

	/**
	 * Close `howMany` blockquotes.
	 * @param {Number} howMany How many blockquotes should the function close
	 * @returns {string}
	 */
	#closeBlockQuotes(howMany) {
		this.#result += "</blockquote>\n".repeat(howMany);
	}

	/**
	 * Parse the begining of one line of a blockquote.
	 * @param {Number} quotingDepth The current nesting depth of quoting blocks. 
	 * @returns {Number} Return the new quoting depth.
	 */
	#parseBlockQuotes(quotingDepth) {
		if(this.#currentChar != '>') {
			if(quotingDepth != 0) {
				this.#closeBlockQuotes(quotingDepth);
				console.info("Blockquote ended.");
			}
			return 0;
		}

		let depth = 0;
		while(this.#currentChar == '>') {
			depth++;
			this.#skip();
		}

		if(this.#currentChar != ' ') {
			this.#closeBlockQuotes(quotingDepth);
			console.warn("Blockquotes ended because a line didn't have a space after `>` characters.");
			
			this.#result += MarkdownParser.specialChars['>'].repeat(depth);
			return 0;
		}

		if(depth > quotingDepth+1)
			throw new Error(`Can't quote at a nesting level of ${depth} when the previous line's nesting level was ${quotingDepth}.`);

		if(depth == quotingDepth+1) {
			this.#result += "<blockquote>";
			return quotingDepth+1;
		}
		if(depth < quotingDepth) {
			this.#closeBlockQuotes(quotingDepth - depth);
			quotingDepth = depth;
		}

		//else depth == quotingDepth
		this.#result += "<br />\n";
		return quotingDepth
	}

	/**
	 * Parse styles from the iterator position:
	 * + italic
	 * + bold
	 * @returns {boolean} Return a boolean indicating the success of the function in finding a style to apply (whether or not the user should use `continue`).
	 */
	#parseStyle(/*void*/) {
		//asterix bold
		if(this.#currentChar == '*' ) {
			if(this.#nextChar == '*') {
				this.#result += this.correspondingStyleTag('**');
				this.#skip();		//skipping the second *
			} else {
				this.#result += this.correspondingStyleTag('*');		//asterix italic
			}

			return true;
		}

		return false;	//no style
	}

	/**
	 * Check if a marker is at the iterator position, does NOT change the iterator's position if returned false.
	 * @returns {boolean} Return the result of the text.
	 */
	#checkOrderedList(/*void*/) {
		if(!/\d/.test(this.#currentChar)) 
			return false;

		let newPos = this.#position;
		while(/\d/.test(this.#toParse[newPos]))		//skipping all nums
			newPos++;

		if(this.#toParse[newPos] != '.')
			return false;
		this.#skipTo(newPos+1);
		return true;
	}

	/**
	 * Detect which type of list is located at `#currentChar`, return `this.listCallback.notAList` if found none.
	 * @returns {ListEnum}
	 */
	#detectList(/*void*/) {
		for (const i in this.listCheckCallback) {
			if(this.listCheckCallback[i]())
				return i;
		}
		return this.listCheckCallback.notAList;
	}

	/**
	 * Parse lists.
	 * @param {ListEnum} listType The HTML tag of the list, ex: `"ul"` for unordered lists.
	 * @param {Number} [nestlvl=0] The nesting level of the list
	 * @param {Number} [quoteNestLvl=0] The nesting level of the quote block.
	 * @returns {[Number, boolean]} Return a list containing the new quoting depth and if a \<blockquote\> should be placed.
	 */
	#parseList(listType, nestLvl=0, quoteNestLvl=0) {
		if(listType == MarkdownParser.ListEnum.notAList)
			return;

		if(nestLvl > 127)
			throw new Error("You can't nest more than 127 lists.");

		const tag = MarkdownParser.listTag[listType];
		this.#result += `<${tag}>\n<li>`;

		let firstIteration = true;
		let placeBlockQuote = false;
		for(; !this.isAtEndOfText(); this.#skip(), firstIteration = false) {
			if(this.#previousChar == '\n' && !firstIteration) {		//isFirstChar
				//check for quoting blocks
				{
					const newQuoteNestLvl = this.#parseBlockQuotes(quoteNestLvl);
					if(this.#currentChar == '>' && newQuoteNestLvl < quoteNestLvl) 
						throw new Error("Quoting level inferior compared to the one at the start of the list.");

					quoteNestLvl = newQuoteNestLvl;
					if(newQuoteNestLvl > quoteNestLvl)
						placeBlockQuote = true;
				}

				//parse ordered lists
				const nestCount = this.#countIndentation();
				if(nestCount < nestLvl)
					break;

				if(nestCount == nestLvl) {
					//checking if this is the end of the list
					if(!this.listCheckCallback[listType]()) 
						break;
					
					this.#result += "</li>\n<li>";
					continue;
				}

				placeBlockQuote = false;
				if(nestCount != nestLvl +1)
					throw new Error(`Can't nest ordered list to level ${nestCount} when the current nesting level is ${nestLvl}.`);

				const detetedList = this.#detectList();
				if(detetedList === MarkdownParser.ListEnum.notAList)
					throw new Error("Unexpected indentation in list.");

				[quoteNestLvl, placeBlockQuote] = this.#parseList(detetedList, nestLvl+1, quoteNestLvl);

				if(placeBlockQuote)
					res += "<blockquote>";
				continue;
			}

			if(this.#currentChar == '\\') {
				if(!this.#nextChar) {
					this.#result += '\\';
					break;
				}
				
				this.#result += MarkdownParser.correspondingSpecialChar(this.#nextChar);
				this.#skip();
				continue;
			}

			if(this.#currentChar == '<' || this.#currentChar == '>')	//escaped < and > are handled above
				throw new Error("Can't insert HTML into lists, try to escaping `<` and `>`.");

			//parse style
			if(this.#parseStyle())
				continue;


			//else it's regular text
			if(this.#parseRegularText())
				break;
		}

		this.#result += `</li></${tag}>\n`;
		if(!this.isAtEndOfText())
			this.#goBack();		//prevent skipping the first character of the <li>
		return [quoteNestLvl, placeBlockQuote];
	}

	/**
	 * Parse ordered lists.
	 * @param {Number} [nestlvl=0] The nesting level of the list
	 * @param {Number} [quoteNestLvl=0] The nesting level of the quote block.
	 * @returns {Number} The new quoting depth.
	 */
	#parseOrderedList(nestLvl=0, quoteNestLvl=0) {
		return this.#parseList(MarkdownParser.ListEnum.ordered, nestLvl, quoteNestLvl);
	}

	/**
	 * Parse unordered lists.
	 * @param {Number} [nestlvl=0] The nesting level of the list
	 * @param {Number} [quoteNestLvl=0] The nesting level of the quote block.
	 * @returns {Number} The new quoting depth.
	 */
	#parseUnorderedList(nestLvl=0, quoteNestLvl=0) {
		return this.#parseList(MarkdownParser.ListEnum.unordered, nestLvl, quoteNestLvl);
	}

	/**
	 * Parse an output tag.
	 * @returns {boolean} If the begining or ending tag of an `<output>` element was found.
	 */
	#parseOutputTag(/*void*/) {
		const sliced = this.#toParse.slice(this.#position, this.#position+10);
		if(sliced.slice(0, -2) == "<output>") {
			this.#openedOutputTag++;
			this.#result += "<output>";

			this.#skip(7);	 //skipping the <output>
			return true;
		}
		if (sliced == "</output>") {
			if(this.#openedOutputTag <= 0) 
				throw new Error("Trying to close the <output> element without any opened.");
			this.#openedOutputTag--;
			this.#result += "</output>";

			this.#skip(8);
			return true;
		}
		return false;
	}

	/**
	 * Convert markdown to HTML
	 */
	parseToHTML(text) {
		this.#toParse = text;
		this.#updateChars();
		this.#result = '';

		var quotingDepth = 0;
		var quoted = false;

		for (; !this.isAtEndOfText(); this.#skip()) {
			const isFirstChar = this.#previousChar == '\n' || this.#position == 0 || quoted;	//if #currentChar is the first character of the line

			//handling escapes
			if(this.#currentChar == '\\') {
				if(!this.#nextChar) {
					this.#result += '\\';
					break;
				}

				this.#result += MarkdownParser.correspondingSpecialChar(this.#skip());
				continue;
			}
			
			//blockquotes
			if(isFirstChar && this.#currentChar == '>') {
				quotingDepth = this.#parseBlockQuotes(quotingDepth);
			
				quoted = true;	//The next character will be considered as the first
				continue;
			}
			if(isFirstChar && !quoted && quotingDepth > 0) {	//=> #currentChar != '>'
				console.info("Setting blockquote nesting level to 0");
				this.#closeBlockQuotes(quotingDepth);
				quotingDepth = 0;
			}
			quoted = false; //resetting quoted so `isFirstChar` isn't always true

			//preventing XSS injections (The user can output HTML but only in <output>)
			if(this.#currentChar == '<')
				if(this.#parseOutputTag())
					continue;

			//titles
			if(isFirstChar && this.#currentChar == '#') {
				this.#parseTitles();
				continue;
			}
			
			//ordered lists
			if(isFirstChar && this.#checkOrderedList()) {
				let placeBlockQuote;
				[quotingDepth, placeBlockQuote] = this.#parseOrderedList(0, quotingDepth);
				
				if(placeBlockQuote)
					this.#result += "<blockquote>";
				continue;
			}

			//unrdered lists
			if(this.listCallback[MarkdownParser.ListEnum.unordered]()) {
				let placeBlockQuote;
				[quotingDepth, placeBlockQuote] = this.#parseUnorderedList(0, quotingDepth);
				
				if(placeBlockQuote)
					this.#result += "<blockquote>";
				continue;
			}

			//style
			if(this.#parseStyle())
				continue;

			//else it's regular text
			if(this.#parseRegularText())
				this.#result += "<br />\n<br />"
		}

		this.#closeBlockQuotes(quotingDepth);
		return this.#result;
	}

	/**
	 * Clean HTML.
	 * @param {string} html The HTML to clean.
	 * @returns {string}
	 */
	static clean(html) {
		var root = document.createElement("root");
		root.innerHTML = html;

		let res = '';
		for(const node in root.children) {
			if(node.innerHTML != '')
				res += node.outerHTML;
		}

		root.remove();
		return res;
	}

	/**
	 * Return a cleaned parsing result by `MarkdownParser.clean()`, update the member `#result`.
	 * @returns {string}
	 */
	clean(/*void*/) {
		this.#result = MarkdownParser.clean(this.#result);
		return this.#result;
	}
}