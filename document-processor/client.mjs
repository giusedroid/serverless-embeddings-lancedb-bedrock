import { LanceDB } from "langchain/vectorstores/lancedb"
import { BedrockEmbeddings } from "langchain/embeddings/bedrock"
import { connect } from "vectordb"


const [
    BUCKET_NAME,
    TABLE_NAME,
    PROMPT_PATH,
    AWS_REGION
] = process.argv.slice(2)

console.log("from nodejs script bucket, table, prompt, region")
console.log(BUCKET_NAME)
console.log(TABLE_NAME)
console.log(PROMPT_PATH)
console.log(AWS_REGION)


import fs from 'fs/promises';

async function loadJsonFile(filePath) {
  try {
    // Read the file
    const data = await fs.readFile(filePath, 'utf8');
    // Parse the JSON content
    const object = JSON.parse(data);
    return object;
  } catch (error) {
    console.error('Error reading or parsing JSON file:', error);
    throw error; // re-throwing the error is important if you want to handle it further up the chain
  }
}


//
//  You can open a LanceDB dataset created elsewhere, such as LangChain Python, by opening
//     an existing table
//
export const run = async (BUCKET_NAME, TABLE_NAME, PROMPT_PATH) => {
  const uri = `s3://${BUCKET_NAME}/embeddings`
  
  const db = await connect(uri)
  const table = await db.openTable(TABLE_NAME)

  const vectorStore = new LanceDB(
      new BedrockEmbeddings( { region: AWS_REGION }), 
      { table }
    )
    const {prompt} = await loadJsonFile(PROMPT_PATH)

  const resultOne = await vectorStore.similaritySearch(prompt, 1)
  console.log(resultOne)
  // [ Document { pageContent: 'Hello world', metadata: { id: 1 } } ]
}

run(BUCKET_NAME, TABLE_NAME, PROMPT_PATH)