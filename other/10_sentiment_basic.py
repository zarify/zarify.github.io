score = 0
words = s.split()

words = [w for w in words if w.lower().strip(punctuation) not in stopwords]

for pos, word in enumerate(words):
    mod = 1
    if word.isupper():
        mod += 0.5
    word = word.lower().strip(punctuation)
    
    if pos != 0:
        if words[pos-1].lower().strip(punctuation) in mods:
            mod += 0.25
        if words[pos-1].lower().strip(punctuation) in inverters:
            mod *= -1
    if word in v_good:
        score += 2 * mod
    elif word in good:
        score += 1 * mod
    elif word in v_bad:
        score -= 2 * mod
    elif word in bad:
        score -= 1 * mod