const { Plugin } = require("obsidian");

module.exports = class CustomFootnotesPlugin extends Plugin {
  async onload() {
    console.log("Loading Custom Footnotes plugin");

    this.registerMarkdownPostProcessor((element, context) => {
      this.processFootnotes(element, context);
    });

    // Handle scroll to reposition sidenotes
    this.registerDomEvent(window, "scroll", () => {
      this.updateAllSidenotes();
    });

    // Handle resize
    this.registerDomEvent(window, "resize", () => {
      this.updateAllSidenotes();
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
      setTimeout(() => {
        this.createSidenotes(allFootnotes);
      }, 100);
    }
  }

  createSidenotes(footnotes) {
    // Find the markdown preview view
    const markdownView = document.querySelector(".markdown-preview-view");
    if (!markdownView) {
      console.warn("Could not find markdown preview view");
      return;
    }

    // Find or create container
    let container = markdownView.querySelector(".custom-sidenotes-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "custom-sidenotes-container";
      markdownView.appendChild(container);
    } else {
      container.innerHTML = "";
    }

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

      container.appendChild(sidenote);

      // Position after adding to DOM
      requestAnimationFrame(() => {
        this.positionSidenote(sidenote, footnote.ref);
      });
    });
  }

  positionSidenote(sidenote, ref) {
    if (!ref || !ref.getBoundingClientRect) return;

    const refRect = ref.getBoundingClientRect();

    // Position relative to viewport since container is fixed
    // Subtract offset to align better with the reference line
    const topPosition = refRect.top + window.scrollY - 60;

    sidenote.style.top = `${topPosition}px`;
  }

  updateAllSidenotes() {
    const container = document.querySelector(".custom-sidenotes-container");
    if (!container) return;

    const sidenotes = container.querySelectorAll(".custom-sidenote");
    sidenotes.forEach((sidenote) => {
      const noteId = sidenote.getAttribute("data-note-id");
      const ref = document.querySelector(
        `.custom-footnote-ref[data-note-id="${noteId}"]`,
      );
      if (ref) {
        this.positionSidenote(sidenote, ref);
      }
    });
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
