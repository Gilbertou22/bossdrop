import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Spin, Alert, Row, Col, Popconfirm, Card, Space, Typography, List, Menu, Upload, Avatar, Pagination } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined, HomeOutlined, SketchOutlined, FileDoneOutlined, ShoppingOutlined, BarChartOutlined, DollarOutlined, TeamOutlined, GiftOutlined, CheckCircleOutlined, UserOutlined, CloudUploadOutlined, AuditOutlined, UploadOutlined } from '@ant-design/icons';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const { Option } = Select;
const { Title, Text } = Typography;

const BASE_URL = process.env.REACT_APP_API_URL || '';

const iconMapping = {
    HomeOutlined: <HomeOutlined />,
    SketchOutlined: <SketchOutlined />,
    FileDoneOutlined: <FileDoneOutlined />,
    ShoppingOutlined: <ShoppingOutlined />,
    BarChartOutlined: <BarChartOutlined />,
    DollarOutlined: <DollarOutlined />,
    TeamOutlined: <TeamOutlined />,
    GiftOutlined: <GiftOutlined />,
    CheckCircleOutlined: <CheckCircleOutlined />,
    UserOutlined: <UserOutlined />,
    CloudUploadOutlined: <CloudUploadOutlined />,
    AuditOutlined: <AuditOutlined />,
};

const ManageMenu = () => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const [user, setUser] = useState(null);
    const [menuItems, setMenuItems] = useState([]);
    const [filteredItems, setFilteredItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [dragLoading, setDragLoading] = useState(false);
    const [visible, setVisible] = useState(false);
    const [form] = Form.useForm();
    const [editingItem, setEditingItem] = useState(null);
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [sort, setSort] = useState({ field: 'order', order: 'ascend' });
    const [openKeys, setOpenKeys] = useState([]);

    useEffect(() => {
        const fetchUserInfo = async () => {
            try {
                const res = await axios.get(`${BASE_URL}/api/users/profile`, {
                    headers: { 'x-auth-token': token },
                });
                setUser(res.data);
                if (res.data.role !== 'admin') {
                    navigate('/403');
                }
            } catch (err) {
                message.error('無法獲取用戶信息，請重新登錄');
                navigate('/login');
            }
        };

        if (token) {
            fetchUserInfo();
            fetchMenuItems();
        } else {
            navigate('/login');
        }
    }, [token, navigate]);

    useEffect(() => {
        const filtered = menuItems.filter(item => {
            const roles = Array.isArray(item.roles) ? item.roles : JSON.parse(item.roles || '[]');
            return (
                (item.key.toLowerCase().includes(search.toLowerCase()) ||
                    item.label.toLowerCase().includes(search.toLowerCase())) &&
                roles.includes(user?.role || 'user')
            );
        });
        setFilteredItems(filtered);
        setCurrentPage(1);
    }, [menuItems, search, user]);

    const fetchMenuItems = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${BASE_URL}/api/menu`, {
                headers: { 'x-auth-token': token },
            });
            setMenuItems(res.data);
            setFilteredItems(res.data);
        } catch (err) {
            message.error({
                content: '載入菜單項失敗',
                duration: 3,
                onClose: () => fetchMenuItems(),
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateOrUpdate = async (values) => {
        setLoading(true);
        const formData = new FormData();
        formData.append('key', values.key);
        formData.append('label', values.label);
        formData.append('icon', values.icon || '');
        const roles = Array.isArray(values.roles) ? values.roles : [];
        formData.append('roles', JSON.stringify(roles));
        const children = Array.isArray(values.children) ? values.children : [];
        formData.append('children', JSON.stringify(children));
        formData.append('order', values.order || 0);
        if (values.customIcon && values.customIcon.length > 0) {
            formData.append('customIcon', values.customIcon[0].originFileObj);
        }

        try {
            let response;
            if (editingItem) {
                response = await axios.put(`${BASE_URL}/api/menu/${editingItem._id}`, formData, {
                    headers: { 'x-auth-token': token, 'Content-Type': 'multipart/form-data' },
                });
                message.success('菜單項更新成功');
            } else {
                response = await axios.post(`${BASE_URL}/api/menu`, formData, {
                    headers: { 'x-auth-token': token, 'Content-Type': 'multipart/form-data' },
                });
                message.success('菜單項創建成功');
            }
            fetchMenuItems();
            setVisible(false);
            form.resetFields();
            setEditingItem(null);
        } catch (err) {
            message.error(err.response?.data?.msg || '操作失敗');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        setLoading(true);
        try {
            await axios.delete(`${BASE_URL}/api/menu/${id}`, {
                headers: { 'x-auth-token': token },
            });
            message.success('菜單項刪除成功');
            fetchMenuItems();
        } catch (err) {
            message.error(err.response?.data?.msg || '刪除失敗');
        } finally {
            setLoading(false);
        }
    };

    const handleBatchDelete = async () => {
        if (selectedRowKeys.length === 0) {
            message.warning('請至少選擇一個菜單項進行刪除');
            return;
        }
        setLoading(true);
        try {
            await axios.delete(`${BASE_URL}/api/menu/batch`, {
                headers: { 'x-auth-token': token },
                data: { ids: selectedRowKeys },
            });
            message.success('批量刪除成功');
            fetchMenuItems();
            setSelectedRowKeys([]);
        } catch (err) {
            message.error(err.response?.data?.msg || '批量刪除失敗');
        } finally {
            setLoading(false);
        }
    };

    const onDragEnd = async (result) => {
        if (!result.destination) return;
        setDragLoading(true);
        const reorderedItems = Array.from(filteredItems);
        const [movedItem] = reorderedItems.splice(result.source.index, 1);
        reorderedItems.splice(result.destination.index, 0, movedItem);
        setFilteredItems(reorderedItems);
        try {
            await Promise.all(reorderedItems.map((item, index) =>
                axios.put(`${BASE_URL}/api/menu/${item._id}`, { ...item, order: index }, {
                    headers: { 'x-auth-token': token },
                })
            ));
            message.success('菜單項排序已更新');
        } catch (err) {
            message.error('排序更新失敗');
            fetchMenuItems();
        } finally {
            setDragLoading(false);
        }
    };

    const handleTableChange = (pagination, _, sorter) => {
        setCurrentPage(pagination.current);
        setPageSize(pagination.pageSize);
        if (sorter.field && sorter.order) {
            setSort({
                field: sorter.field,
                order: sorter.order,
            });
            const sortedItems = [...filteredItems].sort((a, b) => {
                const valueA = a[sorter.field] || '';
                const valueB = b[sorter.field] || '';
                if (sorter.order === 'ascend') {
                    return valueA.localeCompare(valueB);
                }
                return valueB.localeCompare(valueA);
            });
            setFilteredItems(sortedItems);
        }
    };

    const rowSelection = {
        selectedRowKeys,
        onChange: (selectedKeys) => setSelectedRowKeys(selectedKeys),
    };

    const columns = [
        {
            title: '',
            key: 'drag',
            width: 30,
            render: () => <span style={{ cursor: 'move' }}>:::</span>,
        },
        { title: '路徑', dataIndex: 'key', key: 'key', sorter: true, width: 150 },
        { title: '顯示名稱', dataIndex: 'label', key: 'label', sorter: true, width: 150 },
        {
            title: '圖標',
            dataIndex: 'icon',
            key: 'icon',
            width: 120,
            render: (icon, record) => record.customIcon ? (
                <Avatar src={record.customIcon} size={20} />
            ) : icon ? (
                <Space>
                    {iconMapping[icon]}
                    <Text>{icon}</Text>
                </Space>
            ) : '無',
        },
        {
            title: '可見角色',
            dataIndex: 'roles',
            key: 'roles',
            render: roles => {
                const parsedRoles = Array.isArray(roles) ? roles : JSON.parse(roles || '[]');
                return parsedRoles.join(', ');
            },
            width: 150,
        },
        {
            title: '子菜單',
            dataIndex: 'children',
            key: 'children',
            render: children => children.length > 0 ? (
                <List
                    size="small"
                    dataSource={children}
                    renderItem={child => <List.Item>{child.label}</List.Item>}
                />
            ) : '無',
            width: 200,
        },
        { title: '排序', dataIndex: 'order', key: 'order', width: 100 },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Row gutter={[8, 8]} justify="center">
                    <Col>
                        <Button
                            onClick={() => {
                                setEditingItem(record);
                                setVisible(true);
                                const parsedRoles = Array.isArray(record.roles) ? record.roles : JSON.parse(record.roles || '[]');
                                form.setFieldsValue({
                                    key: record.key,
                                    label: record.label,
                                    icon: record.icon,
                                    roles: parsedRoles,
                                    order: record.order,
                                    children: record.children.map(child => child._id),
                                    customIcon: record.customIcon ? [{ uid: '-1', name: 'icon', status: 'done', url: record.customIcon }] : [],
                                });
                            }}
                            disabled={loading}
                            type="primary"
                            shape="round"
                            size="small"
                            icon={<EditOutlined />}
                        >
                            編輯
                        </Button>
                    </Col>
                    <Col>
                        <Popconfirm
                            title="確認刪除此菜單項？"
                            onConfirm={() => handleDelete(record._id)}
                            okText="是"
                            cancelText="否"
                            disabled={loading}
                        >
                            <Button
                                danger
                                disabled={loading}
                                shape="round"
                                size="small"
                                icon={<DeleteOutlined />}
                            >
                                刪除
                            </Button>
                        </Popconfirm>
                    </Col>
                </Row>
            ),
            width: 150,
        },
    ];

    // 為 paginatedItems 添加索引
    const paginatedItems = filteredItems
        .slice((currentPage - 1) * pageSize, currentPage * pageSize)
        .map((item, index) => ({
            ...item,
            dragIndex: index, // 添加 dragIndex 字段
        }));

    const handleMenuClick = ({ key }) => {
        message.info(`導航到 ${key}`);
    };

    const onOpenChange = (keys) => {
        setOpenKeys(keys);
    };

    return (
        <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: 'calc(100vh - 64px)', paddingTop: '84px', boxSizing: 'border-box' }}>
            <Card
                title={
                    <Space>
                        <Title level={2} style={{ margin: 0, color: '#1890ff' }}>菜單管理</Title>
                        {selectedRowKeys.length > 0 && (
                            <Text type="secondary">已選擇 {selectedRowKeys.length} 個菜單項</Text>
                        )}
                    </Space>
                }
                bordered={false}
                style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', borderRadius: '12px' }}
            >
                <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
                    <Col xs={24} sm={12} md={6}>
                        <Input.Search
                            placeholder="搜索路徑或名稱"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ width: '100%' }}
                            enterButton={<SearchOutlined />}
                        />
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                        <Button
                            type="primary"
                            onClick={() => setVisible(true)}
                            disabled={loading}
                            icon={<PlusOutlined />}
                            style={{ width: '100%', borderRadius: '8px' }}
                        >
                            新增菜單項
                        </Button>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                        <Popconfirm
                            title={
                                <div>
                                    確認批量刪除以下菜單項？<br />
                                    {menuItems.filter(item => selectedRowKeys.includes(item._id)).map(item => (
                                        <div key={item._id}>- {item.label}</div>
                                    ))}
                                </div>
                            }
                            onConfirm={handleBatchDelete}
                            okText="是"
                            cancelText="否"
                            disabled={loading || selectedRowKeys.length === 0}
                        >
                            <Button
                                type="danger"
                                icon={<DeleteOutlined />}
                                disabled={loading || selectedRowKeys.length === 0}
                                style={{ width: '100%', borderRadius: '8px' }}
                            >
                                批量刪除
                            </Button>
                        </Popconfirm>
                    </Col>
                </Row>
                <Spin spinning={loading || dragLoading} size="large">
                    {filteredItems.length === 0 && !loading ? (
                        <Alert
                            message="無菜單項"
                            description="目前沒有符合條件的菜單項記錄。"
                            type="info"
                            showIcon
                            style={{ marginBottom: '16px' }}
                        />
                    ) : (
                        <>
                            <DragDropContext onDragEnd={onDragEnd}>
                                <Droppable droppableId="menuItems">
                                    {(provided) => (
                                        <div {...provided.droppableProps} ref={provided.innerRef}>
                                            <Table
                                                rowSelection={rowSelection}
                                                dataSource={paginatedItems}
                                                columns={columns}
                                                rowKey="_id"
                                                bordered
                                                scroll={{ x: 'max-content' }}
                                                rowClassName="table-row-hover"
                                                onChange={handleTableChange}
                                                components={{
                                                    body: {
                                                        row: ({ children, ...props }) => (
                                                            <Draggable draggableId={props['data-row-key']} index={props['data-row-index']}>
                                                                {(provided, snapshot) => (
                                                                    <tr
                                                                        ref={provided.innerRef}
                                                                        {...provided.draggableProps}
                                                                        {...provided.dragHandleProps}
                                                                        {...props}
                                                                        style={{
                                                                            ...provided.draggableProps.style,
                                                                            backgroundColor: snapshot.isDragging ? '#e6f7ff' : undefined,
                                                                        }}
                                                                    >
                                                                        {children}
                                                                    </tr>
                                                                )}
                                                            </Draggable>
                                                        ),
                                                    },
                                                }}
                                                pagination={false}
                                                data-row-index={(record) => record.dragIndex} // 傳遞 dragIndex 給 row
                                            />
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </DragDropContext>
                            <Pagination
                                current={currentPage}
                                pageSize={pageSize}
                                total={filteredItems.length}
                                onChange={setCurrentPage}
                                onShowSizeChange={(current, size) => {
                                    setCurrentPage(1);
                                    setPageSize(size);
                                }}
                                style={{ marginTop: '16px', textAlign: 'right' }}
                                showSizeChanger
                                pageSizeOptions={['10', '20', '50']}
                                showTotal={(total) => `共 ${total} 條記錄`}
                            />
                        </>
                    )}
                </Spin>
                <Card title="菜單預覽" style={{ marginTop: '16px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)' }}>
                    <Menu
                        mode="inline"
                        openKeys={openKeys}
                        onOpenChange={onOpenChange}
                        onClick={handleMenuClick}
                        items={filteredItems.map(item => ({
                            key: item.key,
                            label: item.label,
                            icon: item.customIcon ? <Avatar src={item.customIcon} size={20} /> : (iconMapping[item.icon] || null),
                            children: item.children ? item.children.map(child => ({
                                key: child.key,
                                label: child.label,
                                icon: child.customIcon ? <Avatar src={child.customIcon} size={20} /> : (iconMapping[child.icon] || null),
                            })) : undefined,
                        }))}
                    />
                </Card>
            </Card>
            <Modal
                title={editingItem ? '編輯菜單項' : '新增菜單項'}
                open={visible}
                onCancel={() => {
                    setVisible(false);
                    setEditingItem(null);
                    form.resetFields();
                }}
                footer={null}
                transitionName="ant-fade"
            >
                <Form form={form} onFinish={handleCreateOrUpdate} layout="vertical">
                    <Form.Item
                        name="key"
                        label="路徑"
                        rules={[{ required: true, message: '請輸入路徑！' }]}
                    >
                        <Input placeholder="例如：/ 或 /wallet" />
                    </Form.Item>
                    <Form.Item
                        name="label"
                        label="顯示名稱"
                        rules={[{ required: true, message: '請輸入顯示名稱！' }]}
                    >
                        <Input placeholder="例如：首頁" />
                    </Form.Item>
                    <Form.Item
                        name="icon"
                        label="預定義圖標"
                    >
                        <Select placeholder="選擇圖標" allowClear>
                            {Object.keys(iconMapping).map(icon => (
                                <Option key={icon} value={icon}>
                                    <Space>
                                        {iconMapping[icon]}
                                        {icon}
                                    </Space>
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="customIcon"
                        label="自定義圖標"
                        valuePropName="fileList"
                        getValueFromEvent={(e) => e && e.fileList}
                    >
                        <Upload
                            listType="picture"
                            maxCount={1}
                            beforeUpload={() => false}
                            accept="image/*"
                        >
                            <Button icon={<UploadOutlined />}>上傳自定義圖標</Button>
                        </Upload>
                    </Form.Item>
                    <Form.Item
                        name="roles"
                        label="可見角色"
                        rules={[{ required: true, message: '請選擇可見角色！' }]}
                    >
                        <Select mode="multiple" placeholder="選擇角色">
                            <Option value="user">普通用戶</Option>
                            <Option value="admin">管理員</Option>
                            <Option value="moderator">版主</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="children"
                        label="子菜單"
                    >
                        <Select mode="multiple" placeholder="選擇子菜單項" allowClear>
                            {menuItems
                                .filter(item => item._id !== editingItem?._id)
                                .map(item => (
                                    <Option key={item._id} value={item._id}>{item.label}</Option>
                                ))}
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="order"
                        label="排序"
                        rules={[{ type: 'number', message: '請輸入數字！' }]}
                    >
                        <Input type="number" placeholder="數字越小越靠前" />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading} style={{ borderRadius: '8px' }}>
                            提交
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
            <style jsx global>{`
                .table-row-hover:hover {
                    background-color: #f0f4f8 !important;
                }
                .ant-btn-primary, .ant-btn-danger {
                    transition: all 0.3s ease;
                }
                .ant-btn-primary:hover, .ant-btn-danger:hover {
                    transform: scale(1.05);
                }
                .ant-modal {
                    transition: all 0.3s ease;
                }
            `}</style>
        </div>
    );
};

export default ManageMenu;