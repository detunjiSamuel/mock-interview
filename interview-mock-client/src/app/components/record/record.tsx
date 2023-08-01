import React, { useState, useRef } from 'react';

const RecordingButton = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const audioRef = useRef(null);

  const handleButtonClick = () => {
    if (!isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
    setIsRecording(!isRecording);
  };

  const startRecording = () => {
    setRecordedChunks([]);
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.start();

        mediaRecorder.addEventListener('dataavailable', (event) => {
          if (event.data.size > 0) {
            setRecordedChunks((prevChunks) => [...prevChunks, event.data]);
          }
        });

        mediaRecorder.addEventListener('stop', () => {
          const recordedBlob = new Blob(recordedChunks);
          const recordedAudioURL = URL.createObjectURL(recordedBlob);
          setRecordedAudio(recordedAudioURL);
        });
      })
      .catch((error) => {
        console.log('Error accessing microphone', error);
      });
  };

  const stopRecording = () => {
    const mediaStream = audioRef.current.srcObject;
    const mediaTracks = mediaStream.getTracks();
    mediaTracks.forEach((track) => track.stop());
  };

  return (
    <div>
      <button onClick={handleButtonClick}>{isRecording ? 'Stop' : 'Record'}</button>
      {recordedAudio && (
        <audio ref={audioRef} src={recordedAudio} controls />
      )}
    </div>
  );
};

export default RecordingButton;
