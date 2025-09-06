import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getAuthInstance, getFirestoreInstance, setupRecaptcha } from '../config/firebase';
import { toast } from 'react-toastify';
import PhoneInput from 'react-phone-input-2';
import OtpInput from 'react-otp-input';

interface LoginStepProps {
  step: 'phone' | 'otp' | 'role';
  phoneNumber: string;
  otp: string;
  onPhoneChange: (value: string) => void;
  onOtpChange: (value: string) => void;
  onSendOTP: () => void;
  onVerifyOTP: () => void;
  onRoleSelect: (role: 'admin' | 'employee') => void;
  loading: boolean;
}

const LoginStep: React.FC<LoginStepProps> = ({
  step,
  phoneNumber,
  otp,
  onPhoneChange,
  onOtpChange,
  onSendOTP,
  onVerifyOTP,
  onRoleSelect,
  loading
}) => {
  if (step === 'phone') {
    return (
      <div className="login-step animate-fade-in">
        <h2 className="login-title gradient-text">Welcome to F2P Buddy</h2>
        <p className="login-subtitle">✨ Enter your phone number to continue your journey</p>
        
        <div className="form-group">
          <label className="form-label">Phone Number</label>
          <PhoneInput
            country={'in'}
            value={phoneNumber}
            onChange={onPhoneChange}
            inputStyle={{ 
              width: '100%', 
              height: '48px',
              fontSize: '16px',
              border: '2px solid #e1e5e9',
              borderRadius: '8px'
            }}
            containerStyle={{ width: '100%' }}
            buttonStyle={{
              border: '2px solid #e1e5e9',
              borderRadius: '8px 0 0 8px'
            }}
          />
        </div>
        
        <button 
          className="btn hover-scale" 
          onClick={onSendOTP}
          disabled={!phoneNumber || loading}
        >
          {loading ? '🚀 Sending Magic Code...' : '✨ Send OTP'}
        </button>
        
        <div id="recaptcha-container"></div>
      </div>
    );
  }

  if (step === 'otp') {
    return (
      <div className="login-step animate-fade-in">
        <h2 className="login-title gradient-text">Verify Phone Number</h2>
        <p className="login-subtitle">🔐 Enter the 6-digit magic code sent to +{phoneNumber}</p>
        
        <div className="form-group">
          <div className="otp-container">
            <OtpInput
              value={otp}
              onChange={onOtpChange}
              numInputs={6}
              renderSeparator={<span>-</span>}
              renderInput={(props) => <input {...props} />}
              inputStyle={{
                width: '45px',
                height: '45px',
                fontSize: '18px',
                borderRadius: '8px',
                border: '2px solid #e1e5e9',
                textAlign: 'center',
                margin: '0 4px'
              }}
            />
          </div>
        </div>
        
        <button 
          className="btn hover-scale" 
          onClick={onVerifyOTP}
          disabled={otp.length !== 6 || loading}
        >
          {loading ? '🔍 Verifying Magic Code...' : '🎉 Verify & Continue'}
        </button>
        
        <button 
          className="btn-secondary hover-scale" 
          onClick={() => window.location.reload()}
          style={{ marginTop: 'var(--space-lg)' }}
        >
          🔄 Change Phone Number
        </button>
      </div>
    );
  }

  if (step === 'role') {
    return (
      <div className="login-step animate-fade-in">
        <h2 className="login-title gradient-text">Select Your Role</h2>
        <p className="login-subtitle">🎭 Choose how you want to engage with F2P Buddy</p>
        
        <div className="role-selection stagger-animation">
          <div 
            className="role-btn glass-effect hover-lift"
            onClick={() => onRoleSelect('admin')}
            style={{animationDelay: '0.1s'}}
          >
            <div className="role-icon">👨‍💼</div>
            <h3 className="gradient-text">Admin</h3>
            <p>Manage campaigns and lead your team to success</p>
          </div>
          
          <div 
            className="role-btn glass-effect hover-lift"
            onClick={() => onRoleSelect('employee')}
            style={{animationDelay: '0.2s'}}
          >
            <div className="role-icon">👥</div>
            <h3 className="gradient-text">Employee</h3>
            <p>Participate in campaigns and earn amazing rewards</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

const Login: React.FC = () => {
  const [step, setStep] = useState<'phone' | 'otp' | 'role'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const sendOTP = async () => {
    if (!phoneNumber) {
      toast.error('Please enter a valid phone number');
      return;
    }

    setLoading(true);
    try {
      const authInstance = await getAuthInstance();
      const recaptchaVerifier = await setupRecaptcha('recaptcha-container');
      const confirmation = await signInWithPhoneNumber(
        authInstance, 
        `+${phoneNumber}`, 
        recaptchaVerifier
      );
      
      setConfirmationResult(confirmation);
      setStep('otp');
      toast.success('OTP sent successfully!');
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      toast.error(error.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (!confirmationResult || !otp) {
      toast.error('Please enter the OTP');
      return;
    }

    setLoading(true);
    try {
      const result = await confirmationResult.confirm(otp);
      const user = result.user;
      
      // Check if user exists in Firestore
      const dbInstance = await getFirestoreInstance();
      const userDocRef = doc(dbInstance, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        if (userData.role === 'admin') {
          if (userData.organizationId) {
            navigate('/admin/dashboard');
          } else {
            navigate('/admin/setup');
          }
        } else {
          navigate('/employee/dashboard');
        }
      } else {
        setStep('role');
      }
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      toast.error('Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectRole = async (role: 'admin' | 'employee') => {
    const authInstance = await getAuthInstance();
    const user = authInstance.currentUser;
    if (!user) {
      toast.error('Authentication error. Please try again.');
      return;
    }

    setLoading(true);
    try {
      const dbInstance = await getFirestoreInstance();
      await setDoc(doc(dbInstance, 'users', user.uid), {
        uid: user.uid,
        phoneNumber: user.phoneNumber || `+${phoneNumber}`,
        role: role,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      if (role === 'admin') {
        navigate('/admin/setup');
      } else {
        navigate('/employee/dashboard');
      }
      
      toast.success(`Welcome! You've been registered as ${role}.`);
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error('Failed to complete registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <LoginStep
          step={step}
          phoneNumber={phoneNumber}
          otp={otp}
          onPhoneChange={setPhoneNumber}
          onOtpChange={setOtp}
          onSendOTP={sendOTP}
          onVerifyOTP={verifyOTP}
          onRoleSelect={selectRole}
          loading={loading}
        />
      </div>
    </div>
  );
};

export default Login;