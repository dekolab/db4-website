## **Research Methods**

This research combined official government data, human verification and AI-assisted analysis to build, clean and classify the PPPA prohibition database.

### **1\. Data Collection**

The research began by extracting the **Senarai Perintah Larangan** from the Ministry of Home Affairs (KDN) website. KDN’s Enforcement and Control Division also provided a separate list containing the available official justification for each prohibition.

The original metadata included:

* publication title;  
* author or translator;  
* publisher;  
* printer;  
* gazette date;  
* language; and  
* KDN’s stated justification for prohibition.

The official justifications were grouped under seven grounds:

* contrary to law;  
* morality;  
* public interest;  
* national interest;  
* security;  
* public order; and  
* causing public alarm.

A script generated with Claude was used to extract the website records directly into a comma-separated values file. Using a script reduces the risk of information being altered or generated during extraction. Subsequent updates were identified by monitoring KDN’s website and relevant news reports and were added manually.

### 

### **2\. Data Review and Cleaning**

The research team reviewed the extracted records to identify inaccurate, incomplete or misplaced information. Where possible, titles, authors, translators, publishers, printers, languages and other metadata were verified using publicly available sources.

Some information remained unavailable, particularly for older publications. These gaps were retained as unknown or unclear rather than filled without sufficient evidence.

The team then developed additional taxonomies—also referred to as classifications throughout the research—to supplement the original KDN data.

### 

### **3\. Developing Research Taxonomies**

The taxonomies covered three areas.

#### **Publication Type**

Records were classified as:

* **Printed documents:** books, pamphlets, magazines, journals and newspapers;  
* **Visual media:** photographs, drawings, maps, charts and posters;  
* **Audio or recordings:** music, tapes, discs and other sound recordings;  
* **Digital or electronic materials:** databases, internet publications and microfilm; or  
* **Physical goods:** items carrying words, symbols or ideas, such as clothing and watches.

#### **Publication Origin**

Publications were classified as:

* **Local:** produced, published, printed or mainly distributed in Malaysia;  
* **Foreign:** produced or published outside Malaysia;  
* **Both:** involving local and foreign production or distribution; or  
* **Unclear:** origin could not be determined reliably.

#### **Content Taxonomies**

The main themes of prohibited publications were organised into five broad clusters:

* subversive ideological and political content;  
* race, religion and royalty issues;  
* religious doctrinal deviance;  
* obscene or immoral publications; and  
* general or unidentified records.

These were divided into more specific subclusters, including communism or socialism, revolutionary politics, terrorism or militancy, LGBT-related content, Al-Arqam, Syiah, Ahmadiyyah, pornography, and erotic or immoral content.

### 

### **4\. AI-Assisted Classification and Human Review**

The content taxonomies were applied through two stages.

#### **Initial embedding-based classification**

The metadata for each publication—including its title, author, translator and publisher—was combined into a single text string. This was converted into a numerical representation, or embedding, using multilingual sentence-transformer models.

Three models were evaluated:

* `paraphrase-multilingual-mpnet-base-v2`;  
* `intfloat/multilingual-e5-large`; and  
* `BAAI/bge-m3`.

The research used a semi-supervised **anchor-based nearest-centroid method**:

1. **Anchor selection:** Researchers manually identified 265 publications with clear themes across 13 subclusters.  
2. **Centroid computation:** The embeddings of the anchor publications in each subcluster were averaged to represent that subcluster.  
3. **Assignment:** Each publication was assigned to the subcluster with the highest cosine similarity.  
4. **Confidence thresholding:** Low-similarity records were intended to be flagged for manual review or placed under General/Unidentified.

However, the confidence threshold did not reliably identify uncertain records because very few publications received low-confidence scores.

#### **Revised rule-based keyword classification**

The research therefore adopted a more transparent rule-based keyword classifier. The system reviewed the following fields in order:

1. publisher;  
2. author or translator; and  
3. publication title.

Earlier matches took priority. For example, recognised publishers, authors or title terms could assign a publication to Al-Arqam, Syiah, communism or socialism, pornography, or another relevant subcluster.

ChatGPT, Claude and DeepSeek were used to help generate multilingual keywords and phrases. However, the research team determined the taxonomies, reviewed the keyword rules and verified the resulting classifications.

Publications that did not match any rule were placed under **General/Unidentified** for further review.

### 

### **5\. Comparing Research Taxonomies with KDN Justifications**

The analysis kept two coding systems distinct:

* **INITIATE.MY’s taxonomies** describe what a publication appears to contain.  
* **KDN’s justifications** record the formal legal ground used to prohibit it.

This allowed the research to compare content patterns with official grounds—for example, obscene or immoral publications with morality-based prohibitions, and religious doctrinal publications with public-order justifications—without treating the two coding systems as interchangeable.

