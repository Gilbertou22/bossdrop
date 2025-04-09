import React, { useState } from 'react';
import { Modal, Button, Upload, Input, message, Image } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import axios from 'axios';
import logger from '../utils/logger'; // 引入前端日誌工具

const BASE_URL = process.env.REACT_APP_API_URL || '';

const AddAttendeeModal = ({ visible, onCancel, killId, token, onSubmit }) => {
    const [proofImage, setProofImage] = useState(null);
    const [reason, setReason] = useState('');
    const [uploading, setUploading] = useState(false);

    const handleUpload = async ({ file }) => {
        setUploading(true);
        const formData = new FormData();
        formData.append('image', file);

        try {
            const res = await axios.post(`${BASE_URL}/api/upload`, formData, {
                headers: {
                    'x-auth-token': token,
                    'Content-Type': 'multipart/form-data',
                },
            });
            setProofImage(res.data.path); // 假設後端返回圖片路徑
            message.success('圖片上傳成功');
        } catch (err) {
            console.error('Upload error:', err);
            message.error('圖片上傳失敗');
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async () => {
        try {
            const res = await axios.post(
                `${BASE_URL}/api/attendee-requests`,
                {
                    kill_id: killId,
                    proof_image: proofImage,
                    reason: reason || '', // 確保 reason 為空時也提交
                },
                { headers: { 'x-auth-token': token } }
            );
            message.success(res.data.msg || '補單申請提交成功，等待管理員審核');
            onSubmit();
        } catch (err) {
            console.error('Submit attendee request error:', err.response?.data || err);
            message.error(`補單申請提交失敗: ${err.response?.data?.msg || err.message}`);
        }
    };

    return (
        <Modal
            title="補單申請"
            visible={visible}
            onCancel={onCancel}
            footer={[
                <Button key="cancel" onClick={onCancel}>
                    取消
                </Button>,
                <Button key="submit" type="primary" onClick={handleSubmit} loading={uploading}>
                    提交
                </Button>,
            ]}
        >
            <div style={{ marginBottom: '16px' }}>
                <Upload
                    beforeUpload={() => false} // 阻止自動上傳
                    onChange={handleUpload}
                    showUploadList={false}
                >
                    <Button icon={<UploadOutlined />} loading={uploading}>
                        上傳在場證明
                    </Button>
                </Upload>
                {proofImage && (
                    <div style={{ marginTop: '8px' }}>
                        <Image src={proofImage} alt="在場證明" width={100} />
                    </div>
                )}
            </div>
            <div>
                <Input.TextArea
                    rows={4}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="請輸入補單原因（可選）"
                />
            </div>
        </Modal>
    );
};

export default AddAttendeeModal;