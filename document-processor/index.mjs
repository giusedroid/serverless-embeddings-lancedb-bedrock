// langchain imports
import { BedrockEmbeddings } from 'langchain/embeddings/bedrock'
import { CharacterTextSplitter } from 'langchain/text_splitter'
import { PDFLoader } from 'langchain/document_loaders/fs/pdf'
import { LanceDB } from 'langchain/vectorstores/lancedb'

// lancedb imports
import { connect } from 'vectordb' // LanceDB

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { createWriteStream } from 'fs'
import { pipeline } from 'stream'
import { promisify } from 'util'
import { mkdir } from 'fs/promises'
import path from 'path'

// Promisify the pipeline function so we can use it with async/await
const pipelineAsync = promisify(pipeline)

// env vars
const lanceDbSrc = process.env.s3BucketName
const lanceDbTable = process.env.lanceDbTable
const awsRegion = process.env.region

const splitter = new CharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
})

const embeddings = new BedrockEmbeddings({
  region: awsRegion,
  model: 'amazon.titan-embed-text-v1',
})

const returnError = error => {
  return {
    statusCode: 500,
    body: JSON.stringify({
      message: error
    })
  }
}


const s3Client = new S3Client({ region: awsRegion })

const downloadObject = async (bucketName, objectKey, downloadPath) => {
  try {
    // Get the object from the Amazon S3 bucket
    const getObjectParams = {
      Bucket: bucketName,
      Key: objectKey,
    }
    const command = new GetObjectCommand(getObjectParams)

    const { Body } = await s3Client.send(command)

    // Stream the object to a file
    if (Body) {
      await pipelineAsync(
        Body,
        createWriteStream(downloadPath)
      )
      console.log(`File downloaded to ${downloadPath}`)
    }
  } catch (err) {
    console.error('Error', err)
  }
}

const createDirectory = async () => {
  const tmpPath = path.join('/tmp', 'documents')

  try {
    await mkdir(tmpPath, { recursive: true })
    console.log(`Directory created at: ${tmpPath}`)
  } catch (error) {
    console.error('Error creating directory:', error)
  }
}

export const handler = async (event) => {
  // The S3 event contains details about the uploaded object
  const bucketName = event.Records[0].s3.bucket.name
  const objectKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '))
  const filePath = `/tmp/${objectKey}`
  
  await createDirectory()

  await downloadObject(bucketName, objectKey, filePath)
  
  let loader, docs
  
  try{
    
    loader = new PDFLoader(filePath, {
      splitPages: false
    })
    docs = await loader.loadAndSplit(splitter)

  }catch(error){
    console.error('Error loading documents:', error)
    return returnError(error)
  }
  
  
  const dir = `s3://${lanceDbSrc}/embeddings`
  
  let db, table, createTable = false
  
  try{
    db = await connect(dir)
  }catch(error){
    console.error('Error connecting to LanceDB:', error)
    return returnError(error)
  }
  
  try{
    table = await db.openTable(lanceDbTable)
  }catch(error){
    createTable = true
    console.log('Table not found with error', error)
  }
  
  if(createTable){
    console.log(`${lanceDbTable} table not found. Creating it.`)
    
    try{
      table = await db.createTable(lanceDbTable, [
        { 
          vector: Array(1536), 
          text: 'sample',
        },
      ])
    }catch(error){
        console.error(
          `Error connecting to LanceDB table ${lanceDbTable} :`,
          error
        )
        return returnError(error)
    }
  }

  docs = docs.map(doc => ({
    pageContent: doc.pageContent,
    metadata: {}
  }))
  
  await LanceDB.fromDocuments(docs, embeddings, { table })
  
  return {
    statusCode: 201,
    body: JSON.stringify({
      message: 'OK'
    })
  }

}
