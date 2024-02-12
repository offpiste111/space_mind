import React from 'react'
import { Button, ChakraProvider, FormControl, FormLabel, Input } from '@chakra-ui/react'
import { Modal,ModalOverlay,ModalContent,ModalHeader,ModalBody,useDisclosure,ModalCloseButton, ModalFooter} from "@chakra-ui/react";
    
   const NodeAddModal = (props:any) => {
 

    const initialRef = React.useRef(null)
    const finalRef = React.useRef(null)

    const handleOpen = () => {
        props.onOpen();
    };
    const handleClose = () => {
        props.onClose();
    };

    return (
      <>
        <Modal
            initialFocusRef={initialRef}
            finalFocusRef={finalRef}
            isOpen={props.isOpen}
            onClose={handleClose}>

            <ModalOverlay />
            <ModalContent>
            <ModalHeader>Create your account</ModalHeader>
            <ModalCloseButton />
            <ModalBody pb={6}>
                <FormControl>
                <FormLabel>First name</FormLabel>
                <Input ref={initialRef} placeholder='First name' />
                </FormControl>

                <FormControl mt={4}>
                <FormLabel>Last name</FormLabel>
                <Input placeholder='Last name' />
                </FormControl>
            </ModalBody>

            <ModalFooter>
                <Button colorScheme='blue' mr={3} onClick={handleClose}>
                Save
                </Button>
                <Button onClick={handleClose}>Cancel</Button>
            </ModalFooter>
            </ModalContent>
        </Modal>
      </>
    );
   };
    
   export default NodeAddModal;