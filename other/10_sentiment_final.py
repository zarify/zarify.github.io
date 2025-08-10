from string import punctuation
from stopwords import stops
from math import floor
from json import loads

sentiment_words = {} # word: strength, +ve -ve numbers for polarity

with open("subjclues.txt") as f:
    line = f.readline().strip("\n")
    while line:
        pairs = line.split(" ")
        # 0, 2, -1
        polarity_type = pairs[0].split("=")[1]
        word = pairs[2].split("=")[1]
        strength = pairs[-1].split("=")[1]
        mod = 1
        if strength == "negative":
            mod *= -1
        if polarity_type == "strongsubj":
            mod *= 2
        sentiment_words[word] = mod
        line = f.readline().strip("\n")

# customise good/bad for context
def add_word(word, weight):
    if word not in sentiment_words:
        sentiment_words[word] = weight
    else:
        print(f"Warning: {word} is already in word list with weighting {sentiment_words[word]}.")

def remove_word(word):
    if word in sentiment_words:
        del sentiment_words[word]
    else:
        print(f"Warning: {word} not found in word list.")

# e.g. 'buy' is a good word for product reviews
add_word("buy", 1)
remove_word("really")
remove_word("incredibly")
remove_word("very")
remove_word("just")
remove_word("super")

mods = ["really", "incredibly", "very", "super"]
inverters = ["not", "isn't"]

def analyse(s):
    score = 0
    # break the sentence up into a list of individual words
    words = s.split()
    #print(f"Analysing: {s}")

    # filter out stop words by recreating the list only adding words
    # which are not in the stop word list
    # this list comes from http://xpo6.com/list-of-english-stop-words/
    words = [w for w in words if w.lower().strip(punctuation) not in stops]

    # enumerate gives us position, value pairs for lists
    # pos will store
    for pos, word in enumerate(words):
        # This changes the weighting of a sentiment word
        mod = 1
        if word.isupper():
            mod += 0.5
        word = word.lower().strip(punctuation)
        
        # check if the previous word is a modifier word
        # this should really pay attention to things like sentence endings, but we'll
        # leave that for a later version
        if pos != 0: # not the very first word, since that has no previous word
            prev = words[pos-1].lower().strip(punctuation)
            if prev in mods:
                mod += 0.25
            elif prev in inverters:
                mod *= -1
        
        if word in sentiment_words:
            score += sentiment_words[word] * mod
            #print(f"\t{word} - {sentiment_words[word]} * {mod}")

    # Global sentence modifiers. These change the weighting of the whole
    # sentence, not just the individual words.
    if s[-1] == "!":
        score *= 1.5
        #print("\tExclamation! - * 1.5")
    if s.isupper():
        score *= 1.25
        #print("\tShouty CAPS - * 1.25")
    #print(f"\tScore: {score}")
    return score



with open("Amazon_Instant_Video_5.json") as f:
    line = f.readline()
    matches = 0
    total = 0
    # collect and graph sentiment scores
    scores = []
    while line:
        review = loads(line)
        score = analyse(review["reviewText"])
        scores.append(score)
        overall = review["overall"]
        # check if negative sentiment matches poor overall (1-2 -ve, 3 neutral, 4-5 +ve)
        if (score < 0 and overall < 3) or (score > 0 and overall > 3):
            matches += 1
        elif score == 0 and overall == 3:
            matches += 1
        else:
            pass
            #print(f"Mismatch score {score} vs rating {overall}")
        total += 1
        line = f.readline()
        
    print(f"\nSummary:\n\tTotal reviews: {total}\n\tTotal matches: {matches}\n\tMatch %: {int(matches / total * 100)}")
    print(f"\nScore max: {max(scores)}\nScore min: {min(scores)}")
    
    score_range = max(scores) - min(scores)
    increments = int(score_range / 20) # something arbitrary for histogram buckets
    buckets = [0]*20
    
    for score in scores:
        bucket = floor(score/increments)
        buckets[bucket] += 1
    
    
    mins = int(min(scores))
    for i, bucket in enumerate(buckets):
        perc = int(bucket / total * 100) / 2
        b = i * increments + mins
        print(f"{b:5} to {b + mins - 1:5} " + "*" * int(perc))