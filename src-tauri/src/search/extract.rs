use pulldown_cmark::{Event, Parser};

use crate::domain::TextFormat;

/// Strip formatting and return a plain-text representation suitable for FTS5.
pub fn extract(text: &str, format: TextFormat) -> String {
    match format {
        TextFormat::Plaintext => text.to_string(),
        TextFormat::Markdown => from_markdown(text),
        TextFormat::Html => from_html(text),
        TextFormat::Latex => from_latex(text),
    }
}

fn from_markdown(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for event in Parser::new(text) {
        match event {
            Event::Text(s) | Event::Code(s) => {
                out.push_str(&s);
                out.push(' ');
            }
            Event::SoftBreak | Event::HardBreak | Event::Rule => out.push(' '),
            Event::End(_) => out.push(' '),
            _ => {}
        }
    }
    collapse_whitespace(&out)
}

fn from_html(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut in_tag = false;
    for ch in text.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => {
                in_tag = false;
                out.push(' ');
            }
            _ if !in_tag => out.push(ch),
            _ => {}
        }
    }
    let decoded = out
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'");
    collapse_whitespace(&decoded)
}

fn from_latex(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let bytes = text.as_bytes();
    let mut i = 0;
    let mut in_math = false;
    while i < bytes.len() {
        let b = bytes[i];
        match b {
            b'\\' => {
                i += 1;
                while i < bytes.len() && bytes[i].is_ascii_alphabetic() {
                    i += 1;
                }
                out.push(' ');
            }
            b'$' => {
                in_math = !in_math;
                out.push(' ');
                i += 1;
            }
            b'{' | b'}' => {
                out.push(' ');
                i += 1;
            }
            _ if in_math => i += 1,
            _ => {
                out.push(b as char);
                i += 1;
            }
        }
    }
    collapse_whitespace(&out)
}

fn collapse_whitespace(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut prev_space = true;
    for ch in s.chars() {
        if ch.is_whitespace() {
            if !prev_space {
                out.push(' ');
                prev_space = true;
            }
        } else {
            out.push(ch);
            prev_space = false;
        }
    }
    out.trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plaintext_passthrough() {
        assert_eq!(extract("hello world", TextFormat::Plaintext), "hello world");
    }

    #[test]
    fn markdown_strips_syntax() {
        let md = "# Title\n\nSome **bold** and `code` and a [link](http://x).";
        let out = extract(md, TextFormat::Markdown);
        assert!(out.contains("Title"));
        assert!(out.contains("bold"));
        assert!(out.contains("code"));
        assert!(out.contains("link"));
        assert!(!out.contains("**"));
        assert!(!out.contains("`"));
        assert!(!out.contains('#'));
    }

    #[test]
    fn markdown_fenced_code() {
        let md = "Intro\n\n```rust\nfn foo() { 42 }\n```\n\nOutro.";
        let out = extract(md, TextFormat::Markdown);
        assert!(out.contains("Intro"));
        assert!(out.contains("Outro"));
        assert!(out.contains("foo"));
    }

    #[test]
    fn html_strips_tags() {
        let html = "<p>Hello <b>world</b>&nbsp;&amp; friends</p>";
        let out = extract(html, TextFormat::Html);
        assert_eq!(out, "Hello world & friends");
    }

    #[test]
    fn latex_strips_commands() {
        let tex = "The formula \\frac{a}{b} equals $x^2$ and \\textbf{important}.";
        let out = extract(tex, TextFormat::Latex);
        assert!(out.contains("formula"));
        assert!(out.contains("equals"));
        assert!(out.contains("a"));
        assert!(out.contains("b"));
        assert!(out.contains("important"));
        assert!(!out.contains("\\frac"));
        assert!(!out.contains("\\textbf"));
        assert!(!out.contains('$'));
    }

    #[test]
    fn deeply_nested_latex_no_stack_overflow() {
        let depth = 5_000;
        let mut input = String::new();
        for _ in 0..depth {
            input.push_str("\\textbf{");
        }
        input.push_str("deep");
        for _ in 0..depth {
            input.push('}');
        }
        let out = extract(&input, TextFormat::Latex);
        assert!(out.contains("deep"));
    }

    #[test]
    fn whitespace_collapsed() {
        let md = "a\n\n\n   b   \tc";
        assert_eq!(extract(md, TextFormat::Markdown), "a b c");
    }
}
