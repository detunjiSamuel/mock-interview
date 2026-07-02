import React, { useState, useRef } from 'react';

const RecordingButton = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [recordedAudio, setRecordedAudio] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

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
    if (!audioRef.current) return;
    const mediaStream = audioRef.current.srcObject as MediaStream | null;
    if (!mediaStream) return;
    mediaStream.getTracks().forEach((track) => track.stop());
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
