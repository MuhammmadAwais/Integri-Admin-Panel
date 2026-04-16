import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Form, 
  Button, 
  Row, 
  Col, 
  Stack, 
  Badge,
  Spinner
} from 'react-bootstrap';
import { gsap } from 'gsap';
import { doc, getDoc } from 'firebase/firestore';
import { db } from 'lib/firebase/firebase';

// project-imports
import MainCard from 'components/MainCard';
import { useNewsPublisher } from 'features/news/hooks/useNewsPublisher';
import { cn } from 'lib/utils';

// icons
import { 
  Type, 
  Image as ImageIcon, 
  Video, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  GripVertical,
  UploadCloud,
  FileCheck,
  ChevronLeft,
  X,
  Layers,
  Settings,
  Shield
} from 'lucide-react';

// styles
import 'features/news/styles/news-editor.scss';

export default function NewsEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);
  const { uploadFile, publishNews, progress, isUploading } = useNewsPublisher();

  const [metadata, setMetadata] = useState({
    heading: '',
    topic: 'Economy',
    tags: [],
    countries: [],
    sourceName: '',
    sourceUrl: '',
    status: 'Draft',
    releaseDate: new Date().toISOString().split('T')[0],
    coverImageUrl: '',
    coverVideoUrl: '',
    videoThumbnailUrl: ''
  });

  const [blocks, setBlocks] = useState([
    { id: 'initial-1', type: 'text', content: '' }
  ]);

  const [currentTag, setCurrentTag] = useState('');
  const [currentCountry, setCurrentCountry] = useState('');
  const [isInitializing, setIsInitializing] = useState(isEditMode);
  const blocksRef = useRef(null);

  // Fetch data if in Edit mode
  useEffect(() => {
    if (isEditMode) {
      const fetchDoc = async () => {
        try {
          const docRef = doc(db, 'News', id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setMetadata({
              ...metadata,
              ...data,
              releaseDate: data.releaseDate || new Date().toISOString().split('T')[0]
            });
            if (data.blocks && data.blocks.length > 0) {
              setBlocks(data.blocks.map(b => ({ ...b, id: b.id || Math.random().toString(36).substr(2, 9) })));
            }
          }
        } catch (error) {
          console.error("Error fetching article doc:", error);
        } finally {
          setIsInitializing(false);
        }
      };
      fetchDoc();
    }
  }, [id]);

  // Handle Metadata Changes
  const handleMetaChange = (e) => {
    const { name, value } = e.target;
    setMetadata(prev => ({ ...prev, [name]: value }));
  };

  // Tag & Country Helpers
  const addItem = (field, value, setter) => {
    if (value && !metadata[field].includes(value)) {
      setMetadata(prev => ({ ...prev, [field]: [...prev[field], value] }));
      setter('');
    }
  };

  const removeItem = (field, value) => {
    setMetadata(prev => ({ ...prev, [field]: prev[field].filter(item => item !== value) }));
  };

  // Block Management
  const addBlock = (type) => {
    const newBlock = { 
      id: Math.random().toString(36).substr(2, 9), 
      type, 
      content: '', 
      url: '', 
      caption: '',
      thumbnail: '' 
    };
    setBlocks(prev => [...prev, newBlock]);
    
    // Animation
    setTimeout(() => {
      const elements = blocksRef.current.querySelectorAll('.block-card-sharp');
      const last = elements[elements.length - 1];
      if (last) {
        gsap.from(last, { opacity: 0, y: 30, duration: 0.4, ease: 'expo.out' });
      }
    }, 0);
  };

  const removeBlock = (blockId) => {
    setBlocks(prev => prev.filter(b => b.id !== blockId));
  };

  const updateBlock = (blockId, data) => {
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, ...data } : b));
  };

  const moveBlock = (index, direction) => {
    const newBlocks = [...blocks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < newBlocks.length) {
      [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
      setBlocks(newBlocks);
    }
  };

  // DND Logic
  const [draggedIndex, setDraggedIndex] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
  };

  const handleDrop = (e, index) => {
    if (draggedIndex === null || draggedIndex === index) return;
    const newBlocks = [...blocks];
    const draggedItem = newBlocks[draggedIndex];
    newBlocks.splice(draggedIndex, 1);
    newBlocks.splice(index, 0, draggedItem);
    setBlocks(newBlocks);
    setDraggedIndex(null);
  };

  const handleFileUpload = async (e, type, blockId = null) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const path = blockId ? `news/blocks/${id || 'temp'}/${blockId}` : `news/covers/${id || 'temp'}/${type}`;
      const url = await uploadFile(file, path);
      
      if (blockId) {
        updateBlock(blockId, type === 'video' ? { url } : type === 'thumbnail' ? { thumbnail: url } : { url });
      } else {
        setMetadata(prev => ({ ...prev, [type]: url }));
      }
    } catch (error) {
      alert("Media upload failed. Please verify storage permissions.");
    }
  };

  const handleSave = async (status = null) => {
    if (!metadata.heading) {
      alert("Article headline is required for publication.");
      return;
    }

    const finalData = {
      ...metadata,
      status: status || metadata.status,
      blocks: blocks.map(({ id, ...rest }) => rest)
    };

    try {
      await publishNews(finalData, id);
      navigate('/news');
    } catch (error) {
      alert("Update failed. Verify database connectivity.");
    }
  };

  if (isInitializing) return <div className="p-5 text-center text-white"><Spinner animation="border" size="sm" /> Initializing Article Pipeline...</div>;

  return (
    <div className="news-editor-container">
      {/* 1. Header Toolbar */}
      <Stack direction="horizontal" gap={3} className="mb-5 align-items-center">
        <Button variant="link" className="text-silver p-0" onClick={() => navigate('/news')}>
          <ChevronLeft size={24} />
        </Button>
        <h2 className="editor-title-sharp mb-0">
          {isEditMode ? 'Article Revision Authority' : 'Global Press Release Broadcast'}
        </h2>
        {isUploading && (
          <div className="ms-auto w-25">
             <div className="upload-progress-wrap">
               <div className="progress-bar-gold" style={{ width: `${progress}%` }} />
             </div>
             <small className="text-gold d-block text-end fw-bold">MEDIA SYNC: {Math.round(progress)}%</small>
          </div>
        )}
      </Stack>

      <Row>
        {/* Left: Content Compositor */}
        <Col lg={8}>
          <div className="blocks-management" ref={blocksRef}>
            <div className="mb-3 d-flex align-items-center gap-2 text-silver opacity-50 small fw-bold text-uppercase letter-spacing-1">
              <Layers size={14}/> Content Composition Layer
            </div>
            {blocks.map((block, index) => (
              <div 
                key={block.id} 
                className={cn("block-card-sharp", draggedIndex === index && "opacity-30")}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
              >
                <div className="block-tools-top">
                  <Button variant="link" size="sm" className="text-silver p-1" onClick={() => moveBlock(index, 'up')} disabled={index === 0}>
                    <ArrowUp size={16} />
                  </Button>
                  <Button variant="link" size="sm" className="text-silver p-1" onClick={() => moveBlock(index, 'down')} disabled={index === blocks.length - 1}>
                    <ArrowDown size={16} />
                  </Button>
                  <Button variant="link" size="sm" className="text-danger p-1" onClick={() => removeBlock(block.id)}>
                    <Trash2 size={16} />
                  </Button>
                </div>

                <div className="d-flex w-100">
                   <div className="block-drag-handle pe-4 d-flex align-items-center">
                     <GripVertical size={20} />
                   </div>
                   <div className="flex-grow-1">
                      {block.type === 'text' && (
                        <div>
                          <label className="form-label d-flex align-items-center gap-2">
                             <Type size={14} /> Textual Narrative
                          </label>
                          <Form.Control
                            as="textarea"
                            rows={5}
                            className="editor-input-sharp"
                            placeholder="Draft your professional article copy here..."
                            value={block.content}
                            onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                          />
                        </div>
                      )}

                      {block.type === 'image' && (
                        <div className="d-flex gap-4">
                          <div className="upload-zone-sharp" style={{ width: '220px', minHeight: '120px' }}>
                             {block.url ? (
                               <img src={block.url} className="img-fluid rounded border border-secondary" alt="preview" />
                             ) : (
                               <>
                                 <ImageIcon size={24} className="mb-2" />
                                 <Form.Control type="file" className="d-none" id={`file-${block.id}`} onChange={(e) => handleFileUpload(e, 'image', block.id)} />
                                 <label htmlFor={`file-${block.id}`} className="d-block small text-gold fw-bold">SELECT IMAGE</label>
                               </>
                             )}
                          </div>
                          <div className="flex-grow-1">
                            <label className="form-label">Visual Attribution / Caption</label>
                            <Form.Control
                              type="text"
                              className="editor-input-sharp"
                              placeholder="Image source or description..."
                              value={block.caption}
                              onChange={(e) => updateBlock(block.id, { caption: e.target.value })}
                            />
                            {block.url && <Button variant="link" className="text-danger mt-2 p-0 small text-decoration-none" onClick={() => updateBlock(block.id, { url: '' })}><X size={14}/> CLEAR MEDIA</Button>}
                          </div>
                        </div>
                      )}

                      {block.type === 'video' && (
                         <div className="d-flex gap-4 flex-wrap">
                            <div className="flex-grow-1">
                              <label className="form-label d-flex align-items-center gap-2"><Video size={14}/> Video Asset Deployment</label>
                              <Form.Control 
                                type="text"
                                className="editor-input-sharp mb-2"
                                placeholder="Paste stream URL or upload below..."
                                value={block.url}
                                onChange={(e) => updateBlock(block.id, { url: e.target.value })}
                              />
                              <Form.Control type="file" className="bg-black border-secondary text-silver small" onChange={(e) => handleFileUpload(e, 'video', block.id)} />
                            </div>
                            <div style={{ width: '180px' }}>
                              <label className="form-label">Thumbnail Reference</label>
                              {block.thumbnail ? (
                                <img src={block.thumbnail} className="img-fluid rounded border border-secondary" alt="thumb" />
                              ) : (
                                <div className="upload-zone-sharp p-2">
                                  <Form.Control type="file" className="opacity-0 position-absolute" style={{width:'0'}} id={`thumb-${block.id}`} onChange={(e) => handleFileUpload(e, 'thumbnail', block.id)} />
                                  <label htmlFor={`thumb-${block.id}`} className="small text-silver cursor-pointer">UPLOAD THUMB</label>
                                </div>
                              )}
                            </div>
                         </div>
                      )}
                   </div>
                </div>
              </div>
            ))}
          </div>

          <div className="add-block-panel">
            <button className="btn-add-modular" onClick={() => addBlock('text')}><Type size={16}/> APPEND TEXT</button>
            <button className="btn-add-modular" onClick={() => addBlock('image')}><ImageIcon size={16}/> APPEND IMAGE</button>
            <button className="btn-add-modular" onClick={() => addBlock('video')}><Video size={16}/> APPEND VIDEO</button>
          </div>
        </Col>

        {/* Right: Metadata Pipeline */}
        <Col lg={4}>
          <MainCard title={<span className="text-gold fw-bold"><Settings size={14} className="me-2"/> PUBLICATION METADATA</span>} className="bg-black border-secondary">
            <Stack gap={4}>
              <div>
                <label className="form-label">Article Headline</label>
                <Form.Control
                  name="heading"
                  className="editor-input-sharp"
                  value={metadata.heading}
                  onChange={handleMetaChange}
                  placeholder="Official Press Headline..."
                />
              </div>

              <div>
                <label className="form-label d-flex align-items-center gap-2"><Layers size={14}/> Industry Classification</label>
                <Form.Select 
                  name="topic"
                  className="editor-input-sharp"
                  value={metadata.topic}
                  onChange={handleMetaChange}
                >
                  <option value="Economy">Economy & Finance</option>
                  <option value="Technology">Technology & Innovation</option>
                  <option value="Regional">Regional News</option>
                  <option value="International">International Affairs</option>
                  <option value="Trending">Trending Market</option>
                </Form.Select>
              </div>

              <Row>
                <Col>
                  <label className="form-label">Agency Source</label>
                  <Form.Control name="sourceName" className="editor-input-sharp" value={metadata.sourceName} onChange={handleMetaChange} placeholder="e.g. Reuters"/>
                </Col>
                <Col>
                  <label className="form-label">Public Release</label>
                  <Form.Control type="date" name="releaseDate" className="editor-input-sharp" value={metadata.releaseDate} onChange={handleMetaChange} />
                </Col>
              </Row>

              <div>
                <label className="form-label">Keywords & Tags</label>
                <Stack direction="horizontal" gap={2} className="mb-3 flex-wrap">
                  {metadata.tags.map(tag => (
                    <Badge key={tag} bg="dark" className="border border-gold d-flex align-items-center gap-2 py-2 px-3 rounded-0 text-gold">
                      {tag} <X size={14} className="cursor-pointer" onClick={() => removeItem('tags', tag)} />
                    </Badge>
                  ))}
                </Stack>
                <div className="d-flex gap-2">
                  <Form.Control 
                    className="editor-input-sharp" 
                    placeholder="Add keyword..." 
                    value={currentTag}
                    onChange={(e) => setCurrentTag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addItem('tags', currentTag, setCurrentTag)}
                  />
                  <Button variant="outline-gold" style={{borderColor: '#D4AF37', color: '#D4AF37'}} onClick={() => addItem('tags', currentTag, setCurrentTag)}>Add</Button>
                </div>
              </div>

              <div>
                <label className="form-label">Geographic Target</label>
                <Stack direction="horizontal" gap={2} className="mb-3 flex-wrap">
                  {metadata.countries.map(c => (
                    <Badge key={c} bg="dark" className="border border-silver d-flex align-items-center gap-2 py-2 px-3 rounded-0 text-silver">
                      {c} <X size={14} className="cursor-pointer" onClick={() => removeItem('countries', c)} />
                    </Badge>
                  ))}
                </Stack>
                <div className="d-flex gap-2">
                  <Form.Control 
                    className="editor-input-sharp" 
                    placeholder="Enter region..." 
                    value={currentCountry}
                    onChange={(e) => setCurrentCountry(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addItem('countries', currentCountry, setCurrentCountry)}
                  />
                  <Button variant="outline-silver" style={{borderColor: '#e4e4e7', color: '#e4e4e7'}} onClick={() => addItem('countries', currentCountry, setCurrentCountry)}>Add</Button>
                </div>
              </div>

              <div className="pt-3 border-top border-secondary">
                <label className="form-label">Primary Hero Asset</label>
                <div className="upload-zone-sharp py-4">
                   {metadata.coverImageUrl ? (
                     <div className="position-relative">
                        <img src={metadata.coverImageUrl} className="img-fluid rounded border border-gold" alt="cover" />
                        <Button 
                          variant="danger" 
                          size="sm" 
                          className="position-absolute top-0 end-0 m-2 rounded-0"
                          onClick={() => setMetadata(prev => ({ ...prev, coverImageUrl: '' }))}
                        >
                          <Trash2 size={12} />
                        </Button>
                     </div>
                   ) : (
                     <>
                       <UploadCloud size={24} className="mb-2 opacity-30" />
                       <Form.Control type="file" className="d-none" id="cover-upload" onChange={(e) => handleFileUpload(e, 'coverImageUrl')} />
                       <label htmlFor="cover-upload" className="btn btn-sm btn-outline-gold d-block m-auto" style={{maxWidth:'160px'}}>UPLOAD HERO IMAGE</label>
                     </>
                   )}
                </div>
              </div>
            </Stack>
          </MainCard>
        </Col>
      </Row>

      {/* Sticky Broadcast Control Bar */}
      <div className="editor-sticky-footer">
        <Stack direction="horizontal" gap={4} className="text-silver small fw-bold text-uppercase">
          <div className="d-flex align-items-center gap-2"><Shield size={14} className="text-gold"/> Integrity Status: <span className="text-white">{metadata.status}</span></div>
          <div className="mx-2 opacity-20">|</div>
          <div>Modules Engaged: <span className="text-white">{blocks.length}</span></div>
        </Stack>
        <Stack direction="horizontal" gap={3}>
           <Button variant="outline-secondary" className="rounded-0 text-uppercase fw-bold" disabled={isUploading} onClick={() => handleSave('Draft')}>
             Retain Draft
           </Button>
           <Button 
             className="px-5 d-flex align-items-center gap-2 rounded-0 text-uppercase fw-bold" 
             style={{ background: '#DC143C', border: 'none' }} // Red for primary in editor
             disabled={isUploading} 
             onClick={() => handleSave('Published')}
           >
             {isUploading ? <Spinner size="sm" /> : <FileCheck size={18} />}
             Broadcast Article
           </Button>
        </Stack>
      </div>
    </div>
  );
}
