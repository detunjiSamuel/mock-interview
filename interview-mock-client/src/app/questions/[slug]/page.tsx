"use client"
import Image from 'next/image'

import { useState, useEffect } from 'react';

import { AudioRecorder, useAudioRecorder } from 'react-audio-voice-recorder';

import { useParams } from 'next/navigation'

import SideElement from '../../components/sideElement/SideElement'

import { MAIN_API_URL } from '@/app/AuthContext';


const defualtQuestion = {
 video_url: 'https://storage.googleapis.com/interview-project-bucket/timeDisagreement.mp4',
 topic: 'FAILED TO LOAD QUESTION',
 difficulty: '',
 category: '',
 text: '',
 helpful_tip: ''
}


export default function Home() {
 const [question, setQuestion] = useState({ ...defualtQuestion })
 const params = useParams()

 const auth_token = localStorage.getItem('token')

 const [audio, setAudio] = useState('');

 const recorderControls = useAudioRecorder()

 const addAudioElement = (blob) => {
  const url = URL.createObjectURL(blob);
  setAudio(url)
  console.log("url", url)


 };

 const redoAudio = () => {
  setAudio('')
  console.log("redo")
  //TODO find a better way to do this
  // already added issue in github
  window.location.reload()

 }

 const submitAudio = async () => {
  console.log("submit Audio")

  if (auth_token && recorderControls.recordingBlob != null) {

   const recordingFile = new File([recorderControls.recordingBlob], 'recording.webm', {
    type: 'audio/webm'
   })

   const formData = new FormData();

   formData.append('audio_response', recordingFile);
   formData.append('question_id', params.slug)

   const auth_header = 'Bearer ' + auth_token

   const res = await fetch(MAIN_API_URL + '/api/submit-recording', {
    cache: 'no-store',
    method: 'POST',
    headers: {
     "Authorization": auth_header,
    },
    body: formData
   }
   )


   const data = await res.json()

   console.log(data)

  }


 }


 useEffect(() => {
  console.log("audio", audio);
 }, [audio]);


 useEffect(() => {

  const getQuestion = async () => {

   const res = await fetch(MAIN_API_URL + '/api/questions/' + params.slug, {
    cache: 'no-store',
    headers: {
     "Content-Type": "application/json",
    }
   })

   if (res.ok) {
    const data = await res.json()
    setQuestion(data.question)
   }

  }

  getQuestion()

 }, []);



 return (
  <main className="flex flex-row min-h-screen p-2 pt-6">
   <section className='basis-[40%] card flex flex-col space-y-4'>
    <SideElement
     video_url={question.video_url}
     title={question.topic}
     difficulty={question.difficulty}
     category={question.category}
     question={question.text}
     tip={question.helpful_tip}
    />
   </section>

   <section className='basis-[60%] flex flex-col space-y-48'>
    <div className="flex flex-row justify-between capitalize text-sm ">
     <div className="underline hover:no-underline">
      hows it works
     </div>
     <div className="underline hover:no-underline">
      view all feedback goes here
     </div>
    </div>
    <div className='flex flex-col w-full items-center space-y-4'>


     {audio && (<div>

      <div className='text-center font-mono text-2xl font-bold text-gray-800 mb-6'>
       Lets review your response
      </div>

      <div className='font-mono text-sm font-bold text-gray-800 mb-6 text-center'>
       Here is your response to the question. You can listen to your response and

       submit it to get feedback, or you can re-record your response.
      </div>

     </div>)

     }


     <button
      onClick={recorderControls.startRecording}

      className='flex flex-row justify-center rounded bg-black text-center text-white '>


      <div className="m-2">
       {

        audio ? (<audio controls src={audio} />) : (
         <AudioRecorder
          onRecordingComplete={(blob) => addAudioElement(blob)}
          recorderControls={recorderControls}
          audioTrackConstraints={{
           noiseSuppression: true,
           echoCancellation: true,
          }}
          downloadFileExtension="webm"
          showVisualizer={true}
         />)

       }

      </div>

      {!recorderControls.isRecording && !audio &&
       (<div className='mt-2 p-2'>
        Start Recording your response

       </div>)
      }


     </button>


     {
      audio ? (

       <div className=" flex flex-row w-2/4 justify-center">

        <button onClick={redoAudio} className='m-4 hover:underline'>
         Redo
        </button>

        <button onClick={submitAudio} className=' rounded m-4 bg-black text-white'>
         <text className='m-2'>
          Submit for feedback

         </text>
        </button>

       </div>) :

       (<div className='text-xs whitespace-break-spaces w-2/4 text-center'>
        Read over the prompt and prepare your response.When you are
        ready, click the button above to start recording.
       </div>)
     }
    </div>

   </section>

  </main>
 )
}
