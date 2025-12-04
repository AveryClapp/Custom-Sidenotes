const { Plugin } = require("obsidian");

module.exports = class CustomFootnotesPlugin extends Plugin {
  async onload() {
    console.log("Loading Custom Footnotes plugin");

    this.registerMarkdownPostProcessor((element, context) => {
      this.processFootnotes(element, context);
    }, 100);

    this.registerEvent(
      this.app.workspace.on("file-open", () => {
        this.clearAllSidenotes();
      }),
    );

    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.clearAllSidenotes();
      }),
    );
  }

  onunload() {
    console.log("Unloading Custom Footnotes plugin");
    this.clearAllSidenotes();
  }

  clearAllSidenotes() {
    document.querySelectorAll(".custom-sidenote").forEach((el) => el.remove());
  }

  processFootnotes(element, context) {
    if (
      element.closest(".custom-sidenote") ||
      element.tagName === "CODE" ||
      element.tagName === "PRE"
    ) {
      return;
    }

    const html = element.innerHTML;
    if (!html.includes("^")) return;

    const footnotes = [];
    let newHtml = "";
    let i = 0;

    while (i < html.length) {
      if (html[i] === "^") {
        const remaining = html.slice(i + 1);
        const digitMatch = remaining.match(/^(\d+)\[/);

        if (digitMatch) {
          const noteNum = digitMatch[1];
          const contentStart = i + 1 + digitMatch[0].length;

          let bracketDepth = 1;
          let contentEnd = contentStart;
          let inTag = false;

          while (contentEnd < html.length && bracketDepth > 0) {
            const char = html[contentEnd];

            if (char === "<") {
              inTag = true;
            } else if (char === ">") {
              inTag = false;
            } else if (!inTag) {
              if (char === "[") bracketDepth++;
              else if (char === "]") bracketDepth--;
            }

            if (bracketDepth > 0) contentEnd++;
          }

          if (bracketDepth === 0) {
            const noteContent = html.slice(contentStart, contentEnd);

            newHtml += `<sup class="custom-footnote-ref" data-note-id="${noteNum}">${noteNum}</sup>`;

            footnotes.push({
              id: noteNum,
              content: noteContent,
            });

            i = contentEnd + 1;
            continue;
          }
        }
      }

      newHtml += html[i];
      i++;
    }

    if (footnotes.length > 0) {
      element.innerHTML = newHtml;

      setTimeout(() => {
        this.createSidenotes(footnotes, context);
      }, 50);
    }
  }

  createSidenotes(footnotes, context) {
    const sizer = document.querySelector(".markdown-preview-sizer");
    if (!sizer) {
      console.warn("Could not find .markdown-preview-sizer");
      return;
    }

    for (const footnote of footnotes) {
      const ref = sizer.querySelector(
        `.custom-footnote-ref[data-note-id="${footnote.id}"]`,
      );
      if (!ref) {
        console.warn(`Could not find ref for footnote ${footnote.id}`);
        continue;
      }

      if (
        sizer.querySelector(`.custom-sidenote[data-note-id="${footnote.id}"]`)
      ) {
        continue;
      }

      const sidenote = document.createElement("div");
      sidenote.className = "custom-sidenote";
      sidenote.setAttribute("data-note-id", footnote.id);

      const noteLabel = document.createElement("span");
      noteLabel.className = "sidenote-number";
      noteLabel.textContent = footnote.id;

      const noteContent = document.createElement("span");
      noteContent.className = "sidenote-content";
      noteContent.innerHTML = footnote.content;

      this.setupLinks(noteContent, context.sourcePath);

      sidenote.appendChild(noteLabel);
      sidenote.appendChild(noteContent);

      // Append to sizer
      sizer.appendChild(sidenote);

      // Calculate top position relative to sizer
      const refRect = ref.getBoundingClientRect();
      const sizerRect = sizer.getBoundingClientRect();
      const top = refRect.top - sizerRect.top + sizer.scrollTop;

      sidenote.style.top = `${top}px`;
    }
  }

  setupLinks(element, sourcePath) {
    const links = element.querySelectorAll("a.internal-link, a[data-href]");
    const app = this.app;

    links.forEach((link) => {
      const href = link.getAttribute("data-href") || link.getAttribute("href");
      if (!href) return;

      link.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        app.workspace.openLinkText(href, sourcePath, false);
      };
    });
  }
};
