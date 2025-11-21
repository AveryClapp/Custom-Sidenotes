const { Plugin } = require("obsidian");

module.exports = class CustomFootnotesPlugin extends Plugin {
  async onload() {
    console.log("Loading Custom Footnotes plugin");

    this.registerMarkdownPostProcessor((element, context) => {
      this.processFootnotes(element, context);
    });
  }

  onunload() {
    console.log("Unloading Custom Footnotes plugin");
  }

  processFootnotes(element, context) {
    const textNodes = this.getTextNodes(element);
    const regex = /\^(\d+)\[([^\]]+)\]/g;

    const allFootnotes = [];

    textNodes.forEach((node) => {
      const text = node.textContent;
      if (!regex.test(text)) return;

      regex.lastIndex = 0;

      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      let match;

      while ((match = regex.exec(text)) !== null) {
        const noteNum = match[1];
        const noteContent = match[2];

        if (match.index > lastIndex) {
          fragment.appendChild(
            document.createTextNode(text.slice(lastIndex, match.index)),
          );
        }

        const sup = document.createElement("sup");
        sup.className = "custom-footnote-ref";
        sup.setAttribute("data-note-id", noteNum);
        sup.textContent = noteNum;
        fragment.appendChild(sup);

        allFootnotes.push({
          id: noteNum,
          content: noteContent,
          ref: sup,
        });

        lastIndex = regex.lastIndex;
      }

      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }

      node.parentNode.replaceChild(fragment, node);
    });

    if (allFootnotes.length > 0) {
      // Wait for DOM to update, then position sidenotes
      setTimeout(() => {
        this.createSidenotes(element, allFootnotes);
      }, 10);
    }
  }

  createSidenotes(element, footnotes) {
    let container = element.querySelector(".custom-sidenotes-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "custom-sidenotes-container";
      element.appendChild(container);
    } else {
      container.innerHTML = ""; // Clear existing sidenotes
    }

    // Calculate positions based on reference markers
    const positions = this.calculateSidenotePositions(footnotes, container);

    footnotes.forEach((footnote) => {
      const sidenote = document.createElement("div");
      sidenote.className = "custom-sidenote";
      sidenote.setAttribute("data-note-id", footnote.id);

      const noteLabel = document.createElement("span");
      noteLabel.className = "sidenote-number";
      noteLabel.textContent = footnote.id + ". ";

      const noteContent = document.createElement("span");
      noteContent.textContent = footnote.content;

      sidenote.appendChild(noteLabel);
      sidenote.appendChild(noteContent);

      // Position the sidenote
      const position = positions.get(footnote.id);
      if (position !== undefined) {
        sidenote.style.top = `${position}px`;
      }

      container.appendChild(sidenote);
    });
  }

  calculateSidenotePositions(footnotes, container) {
    const positions = new Map();
    const containerRect = container.getBoundingClientRect();

    // Calculate base positions from reference markers
    const basePositions = footnotes.map((footnote) => {
      const ref = footnote.ref;
      if (!ref || !ref.getBoundingClientRect) {
        return { id: footnote.id, top: 0 };
      }

      const refRect = ref.getBoundingClientRect();
      const relativeTop = refRect.top - containerRect.top;

      return {
        id: footnote.id,
        originalTop: Math.max(0, relativeTop - 20),
        finalTop: Math.max(0, relativeTop - 20),
      };
    });

    // Sort by position
    basePositions.sort((a, b) => a.originalTop - b.originalTop);

    // Resolve collisions - prevent overlapping
    const NOTE_HEIGHT = 80; // Estimated height per note
    const MIN_SPACING = 20;

    for (let i = 1; i < basePositions.length; i++) {
      const current = basePositions[i];
      const previous = basePositions[i - 1];

      const requiredTop = previous.finalTop + NOTE_HEIGHT + MIN_SPACING;

      if (current.finalTop < requiredTop) {
        current.finalTop = requiredTop;
      }
    }

    // Apply final positions
    basePositions.forEach((pos) => {
      positions.set(pos.id, pos.finalTop);
    });

    return positions;
  }

  getTextNodes(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (
          node.parentElement &&
          (node.parentElement.tagName === "CODE" ||
            node.parentElement.tagName === "PRE" ||
            node.parentElement.classList.contains("custom-sidenote"))
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
    }

    return textNodes;
  }
};
